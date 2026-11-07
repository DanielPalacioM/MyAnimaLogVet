import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { catchError, Observable, of, throwError } from 'rxjs';
import { mapApiError } from '../api-error';

const ME = `${VET_API}/me/professional-profile`;

export type LicenseStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ProfessionalDocType = 'PROFESSIONAL_CARD' | 'ID_DOCUMENT' | 'DEGREE';
export type DocStatus = 'PENDING' | 'READY' | 'NEEDS_CORRECTION' | 'REVIEWED';

export interface ProfessionalDocument {
  documentType: ProfessionalDocType;
  status: DocStatus;
  documentId: string | null;
  fileName?: string | null;
}

export interface ProfessionalProfile {
  id: string;
  fullName: string;
  documentType: 'CC' | 'CE' | 'PPT';
  documentNumber: string;
  licenseNumber: string;
  profession: 'MV' | 'MVZ';
  specialty: string | null;
  university: string | null;
  licenseStatus: LicenseStatus;
  signatureUrl?: string | null;
  hasSignature?: boolean;
  rejectionReasonCode?: string | null;
  documents: ProfessionalDocument[];
}

export interface ProfessionalProfileInput {
  fullName: string;
  documentType: 'CC' | 'CE' | 'PPT';
  documentNumber: string;
  profession: 'MV' | 'MVZ';
  licenseNumber: string;
  specialty?: string;
  university?: string;
}

/** Perfil profesional propio (token normal): la tarjeta es de la persona, no de una clínica. */
@Injectable({ providedIn: 'root' })
export class ProfessionalApi {
  private readonly http = inject(HttpClient);

  /** `null` si todavía no creó su perfil (404 `PROFESSIONAL_PROFILE_NOT_FOUND`). */
  get(): Observable<ProfessionalProfile | null> {
    return this.http.get<ProfessionalProfile>(ME).pipe(
      catchError((e: unknown) => (isNotFound(e) ? of(null) : throwError(() => e))),
      mapApiError(),
    );
  }

  save(input: ProfessionalProfileInput): Observable<ProfessionalProfile> {
    return this.http.put<ProfessionalProfile>(ME, input).pipe(mapApiError());
  }

  uploadDocument(type: ProfessionalDocType, file: File): Observable<unknown> {
    const form = new FormData();
    form.append('documentType', type);
    form.append('file', file, `${type.toLowerCase()}.${ext(file)}`);
    return this.http.post(`${ME}/documents`, form).pipe(mapApiError());
  }

  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${ME}/documents/${documentId}`).pipe(mapApiError());
  }

  /** Solo PNG, hasta 1 MB. Se puede volver a subir en cualquier estado. */
  uploadSignature(file: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', file, 'signature.png');
    return this.http.put(`${ME}/signature`, form).pipe(mapApiError());
  }

  submit(): Observable<unknown> {
    return this.http.post(`${ME}/submit`, {}).pipe(mapApiError());
  }
}

const ext = (file: File): string => (file.name.split('.').pop() ?? 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';

const isNotFound = (e: unknown): boolean => {
  const err = e as { status?: number; error?: { code?: string } };
  return err?.status === 404 && (!err.error?.code || err.error.code === 'PROFESSIONAL_PROFILE_NOT_FOUND');
};
