import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { catchError, forkJoin, map, mergeMap, Observable, of, throwError } from 'rxjs';
import { mapApiError } from '../api-error';

const ADMIN = `${VET_API}/admin`;

export type SubjectType = 'CLINIC' | 'PROFESSIONAL';
export type RequestStatus = 'DRAFT' | 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'APPROVED' | 'REJECTED';
export type AiRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type RejectReason = 'NOT_IN_REGISTRY' | 'DATA_MISMATCH' | 'DOCUMENT_INVALID' | 'OTHER';

export interface VerificationItem {
  requestId: string;
  subjectType: SubjectType;
  subjectId: string;
  subjectName: string;
  status: RequestStatus;
  attemptNumber: number;
  submittedAt: string;
  aiStatus: string;
  aiRiskLevel: AiRisk | null;
  /** Solo profesionales: `MV` o `MVZ`. */
  profession?: string;
}

export type StatusCounts = Partial<Record<RequestStatus, number>>;

export interface VerificationQueue {
  items: VerificationItem[];
  total: number;
  counts: StatusCounts;
}

export interface VerificationDocument {
  documentId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  signedUrl: string;
  signedUrlExpiresAt: string;
}

export interface AiCheck {
  ok?: boolean;
  text?: string;
  label?: string;
}

export interface VerificationDetail {
  requestId: string;
  subjectType: SubjectType;
  status: RequestStatus;
  attemptNumber: number;
  submittedAt: string;
  registryChecked: boolean;
  registryLookupUrl?: string;
  /** Datos que declaró el solicitante. Las llaves dependen de si es clínica o profesional. */
  declared: Record<string, string | number | null | undefined>;
  account: { id: string; email?: string; name?: string };
  documents: VerificationDocument[];
  ai: { status: string; riskLevel: AiRisk | null; report: { checks?: (AiCheck | string)[] } | null };
  duplicates: { subjectName?: string; documentType?: string }[];
  history: { requestId: string; attemptNumber: number; status: RequestStatus; submittedAt: string; decidedAt: string | null }[];
}

export interface AdminClinic {
  id: string;
  name: string;
  legalName: string;
  nit: string;
  city: string;
  department: string;
  status: string;
  plan: string | null;
  employeeCount: number;
  createdAt: string;
  approvedAt: string | null;
}

export interface AdminClinicPage {
  items: AdminClinic[];
  total: number;
}

export type ClinicStatus = 'PENDING_DOCUMENTS' | 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface AdminClinicDetail {
  id: string;
  name: string;
  legalName: string | null;
  nit: string | null;
  status: string;
  city: string | null;
  department: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  legalRepName: string | null;
  createdAt: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  subscription: { plan: string; startDate: string; endDate: string; active: boolean } | null;
  employees: { employeeId: string; role: string; active: boolean }[];
  verificationHistory: { requestId: string; attemptNumber: number; status: string; submittedAt: string | null; decidedAt: string | null }[];
}

export interface SubscriptionInput {
  plan: string;
  startDate?: string;
  endDate: string;
}

export interface AdminProfessional {
  id: string;
  fullName: string;
  licenseNumber: string;
  profession: string;
  licenseStatus: string;
  verifiedAt: string | null;
  clinics: { veterinaryId: string; name: string; role: string }[];
}

export interface AdminProfessionalPage {
  items: AdminProfessional[];
  total: number;
}

export interface AdminProfessionalDetail {
  id: string;
  email: string | null;
  fullName: string;
  documentType: string;
  documentNumber: string;
  licenseNumber: string;
  profession: string;
  specialty: string | null;
  university: string | null;
  licenseStatus: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  registryLookupUrl: string | null;
  verificationHistory: { requestId: string; attemptNumber: number; status: string; submittedAt: string | null; decidedAt: string | null }[];
}

// ---- Adaptadores: el backend (GUIA_INTEGRACION_FRONTEND §2g) → los modelos que usa la pantalla ----

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const fromQueueItem = (i: Raw): VerificationItem => ({
  ...(i as VerificationItem),
  subjectName: i['displayName'] ?? i['subjectName'] ?? '',
});

const fromQueue = (q: Raw): VerificationQueue => ({
  items: (q['items'] ?? []).map(fromQueueItem),
  total: q['total'] ?? 0,
  counts: q['counts'] ?? ({} as StatusCounts),
});

/** Arma `declared` desde el bloque `clinic` o `professional` del detalle. */
const declaredOf = (d: Raw): VerificationDetail['declared'] => {
  if (d['declared']) return d['declared'];
  if (d['subjectType'] === 'CLINIC') {
    const c: Raw = d['clinic'] ?? {};
    const rep: Raw = c['legalRepresentative'] ?? {};
    return {
      name: c['name'], legalName: c['legalName'], nit: c['nit'], phone: c['phone'], email: c['email'],
      address: c['address'], city: c['city'], department: c['department'],
      legalRepName: rep['fullName'], legalRepDocumentType: rep['documentType'], legalRepDocumentNumber: rep['documentNumber'],
    };
  }
  const p: Raw = d['professional'] ?? {};
  return {
    fullName: p['fullName'], documentType: p['documentType'], documentNumber: p['documentNumber'], profession: p['profession'],
    licenseNumber: p['licenseNumber'], specialty: p['specialty'], university: p['university'],
    workplaces: (p['workplaces'] ?? []).map((w: Raw) => w['name']).filter(Boolean).join(', '),
  };
};

const fromDetail = (d: Raw): VerificationDetail => {
  const ai: Raw = d['ai'] ?? {};
  return {
    ...(d as VerificationDetail),
    declared: declaredOf(d),
    registryChecked: !!d['registryChecked'],
    account: d['account'] ?? { id: '' },
    documents: d['documents'] ?? [],
    ai: { status: ai['aiStatus'] ?? ai['status'] ?? 'NOT_RUN', riskLevel: ai['aiRiskLevel'] ?? ai['riskLevel'] ?? null, report: ai['report'] ?? null },
    duplicates: (d['duplicates'] ?? []).map((x: Raw) => ({ subjectName: x['otherSubjectName'] ?? x['subjectName'], documentType: x['documentType'] })),
    history: d['history'] ?? [],
  };
};

const fromClinics = (p: Raw): AdminClinicPage => ({
  items: (p['items'] ?? []).map((c: Raw) => ({ ...(c as AdminClinic), employeeCount: c['employeesCount'] ?? c['employeeCount'] ?? 0 })),
  total: p['total'] ?? 0,
});

/** Panel de la plataforma (solo `PLATFORM_ADMIN`, con el token normal). */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  queue(status: RequestStatus, subjectType?: SubjectType): Observable<VerificationQueue> {
    let params = new HttpParams().set('status', status).set('page', 0).set('size', 50);
    if (subjectType) params = params.set('subjectType', subjectType);
    return this.http.get<Raw>(`${ADMIN}/verifications`, { params }).pipe(map(fromQueue), mapApiError());
  }

  detail(requestId: string): Observable<VerificationDetail> {
    return this.http.get<Raw>(`${ADMIN}/verifications/${requestId}`).pipe(map(fromDetail), mapApiError());
  }

  /** El enlace de un documento vence a los 10 minutos: esto pide uno nuevo. */
  renewSignedUrl(requestId: string, documentId: string): Observable<{ signedUrl: string; expiresAt: string }> {
    return this.http.get<{ signedUrl: string; expiresAt: string }>(`${ADMIN}/verifications/${requestId}/documents/${documentId}/signed-url`).pipe(mapApiError());
  }

  approve(requestId: string): Observable<unknown> {
    return this.http.post(`${ADMIN}/verifications/${requestId}/approve`, { registryChecked: true }).pipe(mapApiError());
  }

  reject(requestId: string, reasonCode: RejectReason, notes: string): Observable<unknown> {
    return this.http.post(`${ADMIN}/verifications/${requestId}/reject`, { reasonCode, notes }).pipe(mapApiError());
  }

  requestCorrection(requestId: string, documentTypes: string[], notes: string): Observable<unknown> {
    return this.http.post(`${ADMIN}/verifications/${requestId}/request-correction`, { documentTypes, notes }).pipe(mapApiError());
  }

  rerunAi(requestId: string): Observable<unknown> {
    return this.http.post(`${ADMIN}/verifications/${requestId}/rerun-ai`, {}).pipe(mapApiError());
  }

  clinics(search: string, status?: ClinicStatus | null): Observable<AdminClinicPage> {
    const one = (st?: ClinicStatus | null): Observable<AdminClinicPage> => {
      let params = new HttpParams().set('page', 0).set('size', 50);
      if (search.trim()) params = params.set('search', search.trim());
      if (st) params = params.set('status', st);
      return this.http.get<Raw>(`${ADMIN}/veterinaries`, { params }).pipe(map(fromClinics), mapApiError());
    };
    if (status) return one(status);
    // El listado sin filtro de estado falla (500) en el backend desplegado; si pasa, se arma pidiendo cada estado por separado.
    return one().pipe(
      catchError((e: unknown) => {
        const all: ClinicStatus[] = ['ACTIVE', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'PENDING_DOCUMENTS', 'REJECTED', 'SUSPENDED'];
        let ok = 0;
        return forkJoin(
          all.map((st) =>
            one(st).pipe(
              map((p) => (ok++, p)),
              catchError((err: unknown) => {
                console.warn('Listado de clínicas con estado', st, 'falló:', err);
                return of({ items: [], total: 0 } as AdminClinicPage);
              }),
            ),
          ),
        ).pipe(
          mergeMap((pages) => (ok === 0 ? throwError(() => e) : of({ items: pages.flatMap((p) => p.items), total: pages.reduce((n, p) => n + p.total, 0) }))),
        );
      }),
    );
  }

  clinicDetail(id: string): Observable<AdminClinicDetail> {
    return this.http.get<AdminClinicDetail>(`${ADMIN}/veterinaries/${id}`).pipe(mapApiError());
  }

  /** Crea el plan de una clínica activa (token de la plataforma, aunque la ruta no esté bajo `/admin`). */
  createSubscription(veterinaryId: string, input: Required<SubscriptionInput>): Observable<unknown> {
    return this.http.post(`${VET_API}/${veterinaryId}/subscription`, input).pipe(mapApiError());
  }

  updateSubscription(veterinaryId: string, input: Partial<SubscriptionInput>): Observable<unknown> {
    return this.http.patch(`${VET_API}/${veterinaryId}/subscription`, input).pipe(mapApiError());
  }

  professionals(search: string, verifiedOnly: boolean): Observable<AdminProfessionalPage> {
    let params = new HttpParams().set('page', 0).set('size', 50);
    if (search.trim()) params = params.set('search', search.trim());
    if (verifiedOnly) params = params.set('verified', true);
    return this.http.get<AdminProfessionalPage>(`${ADMIN}/professionals`, { params }).pipe(mapApiError());
  }

  professionalDetail(id: string): Observable<AdminProfessionalDetail> {
    return this.http.get<AdminProfessionalDetail>(`${ADMIN}/professionals/${id}`).pipe(mapApiError());
  }

  suspend(id: string, reason: string): Observable<unknown> {
    return this.http.patch(`${ADMIN}/veterinaries/${id}/suspend`, { reason }).pipe(mapApiError());
  }

  reactivate(id: string): Observable<unknown> {
    return this.http.patch(`${ADMIN}/veterinaries/${id}/reactivate`, {}).pipe(mapApiError());
  }
}
