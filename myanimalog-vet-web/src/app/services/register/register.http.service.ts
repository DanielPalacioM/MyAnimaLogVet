import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { AUTH_API, USER_API, VET_API } from '@auth/auth.config';
import { AccountClinic } from '@auth/models/session.models';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { SessionService } from '@auth/services/session.service';
import { TokenService } from '@auth/services/token.service';
import { catchError, concatMap, defer, from, map, Observable, of, switchMap, tap, throwError, toArray } from 'rxjs';
import { ApiError, mapApiError, toApiError } from '../api-error';
import { ClinicApi } from '../api/clinic.api';
import { LoginHttpService } from '../login/login.http.service';
import {
  AccountInput,
  ClinicAvailability,
  ClinicAvailabilityQuery,
  DocumentType,
  RegistrationReceipt,
  RegistrationSubmission,
  VerificationStatus,
} from './models/registration.model';
import { RegisterService, VerificationSummary } from './register.service';

/**
 * El backend solo acepta letras, números y guion bajo en `username`. Lo armamos con el nombre
 * ("Gustavo Beltrán" → "Gustavo_Beltran"): sin tildes, espacios como "_" y sin otros símbolos.
 */
export const toUsername = (fullName: string): string => {
  const clean = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 30);
  return clean.length >= 3 ? clean : `${clean}_vet`.slice(0, 30);
};

interface RegisteredClinic {
  id: string;
  name: string;
}

interface SubmitResponse {
  requestId: string;
  status: string;
  submittedAt: string;
}

/** `GET /{id}/verification` (GUIA §2c, paso 3). `status` queda por compatibilidad con la colección de Postman. */
interface VerificationResponse {
  requestId?: string;
  requestStatus?: string;
  veterinaryStatus?: string;
  status?: string;
  submittedAt?: string;
  reviewerNotes?: string | null;
  rejectionReason?: string | null;
  attemptsRemaining?: number;
  maxAttempts?: number;
  documents?: { documentType: string; required?: boolean; status?: 'PENDING' | 'READY' | 'NEEDS_CORRECTION' | 'REVIEWED'; fileName?: string | null }[];
}

const PENDING_KEY = 'vet.register.pending';
const CLINIC_DOCUMENTS: readonly DocumentType[] = ['RUT', 'CHAMBER_OF_COMMERCE', 'LEGAL_REP_ID', 'FACADE_PHOTO'];
const PROFILE_DOCUMENTS: readonly DocumentType[] = ['PROFESSIONAL_CARD', 'ID_DOCUMENT', 'DEGREE'];

/**
 * Registro real. Orden (docs/ENTORNOS.md y colección de Postman, carpetas 00, 01, 03 y 04):
 * `POST /user/register` → PIN al correo → `POST /auth/verify-email` → login →
 * `POST /register` (clínica) → token de clínica → representante legal → documentos → perfil profesional →
 * `POST /verification/submit` (queda `UNDER_REVIEW` y la revisa una persona del equipo).
 *
 * Si algún paso falla a la mitad, la clínica ya creada se recuerda (por NIT) y el reintento continúa desde ahí
 * en vez de intentar crearla otra vez.
 */
@Injectable()
export class RegisterHttpService extends RegisterService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly session = inject(SessionService);
  private readonly context = inject(ClinicContextService);
  private readonly clinicApi = inject(ClinicApi);
  private readonly login = inject(LoginHttpService);

  /** La contraseña solo vive en memoria: se usa para entrar justo después de verificar el correo. */
  private password: string | null = null;
  /** El backend manda el PIN al crear la cuenta; el primer "enviar" del flujo no debe pedir otro. */
  private pinJustSent: string | null = null;

  createAccount({ fullName, email, password }: AccountInput): Observable<{ userId: string }> {
    return this.http.post<{ id?: string; userId?: string } | null>(`${USER_API}/user/register`, { username: toUsername(fullName), email, password }).pipe(
      tap(() => {
        this.password = password;
        this.pinJustSent = email;
      }),
      map((res) => ({ userId: res?.userId ?? res?.id ?? '' })),
      catchError((e: unknown) =>
        throwError(() =>
          e instanceof HttpErrorResponse && e.status === 409
            ? new ApiError('EMAIL_TAKEN', 'Ya existe una cuenta con este correo. Inicia sesión para continuar.', 409)
            : toApiError(e),
        ),
      ),
    );
  }

  sendVerificationCode(email: string): Observable<{ resendAfterSeconds: number }> {
    if (this.pinJustSent === email) {
      this.pinJustSent = null;
      return of({ resendAfterSeconds: 45 });
    }
    return this.http.post<void>(`${AUTH_API}/verify-email/resend`, { email }).pipe(
      map(() => ({ resendAfterSeconds: 45 })),
      catchError((e: unknown) =>
        throwError(() =>
          e instanceof HttpErrorResponse && (e.status === 404 || e.status === 405)
            ? new ApiError('RESEND_UNAVAILABLE', 'Por ahora no podemos reenviar el código. Revisa tu correo (y la carpeta de spam) o inténtalo en unos minutos.', e.status)
            : toApiError(e),
        ),
      ),
    );
  }

  verifyEmail(email: string, code: string): Observable<void> {
    return this.http.post<unknown>(`${AUTH_API}/verify-email`, { email, code }).pipe(
      catchError((e: unknown) =>
        throwError(() =>
          e instanceof HttpErrorResponse && [400, 401, 404, 410].includes(e.status)
            ? new ApiError('INVALID_CODE', 'El código no es correcto o ya venció. Revísalo o pide uno nuevo.', e.status)
            : toApiError(e),
        ),
      ),
      // Con el correo verificado se entra de una vez: el registro de la clínica necesita el token normal.
      switchMap(() => this.signInAfterVerify(email)),
    );
  }

  /** No hay endpoint para consultarlo: lo valida el servidor al enviar (NIT, nombre y correo únicos). */
  checkClinicAvailability(_query: ClinicAvailabilityQuery): Observable<ClinicAvailability> {
    return of({ nameTaken: false, nitTaken: false, emailTaken: false });
  }

  submitRegistration(submission: RegistrationSubmission): Observable<RegistrationReceipt> {
    if (!this.tokens.hasSession()) {
      return throwError(
        () => new ApiError('SESSION_REQUIRED', 'Tu sesión no está activa. Inicia sesión con tu cuenta y vuelve a enviar la solicitud.', 401),
      );
    }
    const { profile } = submission;
    const isVet = profile.isVeterinarian === 'yes';

    return this.ensureClinic(submission).pipe(
      switchMap((clinic) => this.enterClinic(clinic)),
      switchMap((clinic) => this.putLegalRep(clinic, submission).pipe(map(() => clinic))),
      switchMap((clinic) => this.uploadLogo(clinic, submission.logo).pipe(map(() => clinic))),
      switchMap((clinic) => this.uploadDocuments(`${VET_API}/${clinic.veterinaryId}/verification/documents`, CLINIC_DOCUMENTS, submission).pipe(map(() => clinic))),
      switchMap((clinic) => (isVet ? this.professionalProfile(submission).pipe(map(() => clinic)) : of(clinic))),
      switchMap((clinic) =>
        this.http
          .post<SubmitResponse>(`${VET_API}/${clinic.veterinaryId}/verification/submit`, { truthfulnessDeclared: true, includeProfessionalProfile: isVet })
          .pipe(map((res) => this.receipt(clinic, res))),
      ),
      tap(() => this.forgetPending(submission)),
      // Deja la sesión con la clínica en revisión (para el panel y el selector).
      switchMap((receipt) =>
        this.context.loadClinics().pipe(
          catchError(() => of([])),
          tap(() => this.session.patchClinic({ status: 'UNDER_REVIEW' })),
          map(() => receipt),
        ),
      ),
      mapApiError(),
    );
  }

  getVerification(_requestId: string, clinicId?: string): Observable<VerificationSummary> {
    const id = clinicId ?? this.tokens.clinicId();
    if (!id) return throwError(() => new ApiError('CLINIC_CONTEXT_REQUIRED', 'Elige primero con qué clínica vas a trabajar.', 403));
    return this.http.get<VerificationResponse>(`${VET_API}/${id}/verification`).pipe(
      map((res) => ({
        requestId: res.requestId ?? '',
        // La clínica activa manda sobre el estado de la solicitud.
        status: toStatus(res.veterinaryStatus === 'ACTIVE' ? 'ACTIVE' : (res.requestStatus ?? res.status)),
        submittedAt: res.submittedAt ?? '',
        note: res.rejectionReason ?? res.reviewerNotes ?? null,
        attemptsRemaining: res.attemptsRemaining,
        maxAttempts: res.maxAttempts,
        documents: (res.documents ?? []).map((d) => ({
          type: d.documentType as DocumentType,
          required: !!d.required,
          status: d.status ?? 'PENDING',
          fileName: d.fileName ?? null,
        })),
      })),
      mapApiError(),
    );
  }

  retryVerification(clinicId?: string): Observable<void> {
    const id = clinicId ?? this.tokens.clinicId();
    if (!id) return throwError(() => new ApiError('CLINIC_CONTEXT_REQUIRED', 'Elige primero con qué clínica vas a trabajar.', 403));
    return this.http.post(`${VET_API}/${id}/verification/retry`, {}).pipe(
      map(() => undefined),
      mapApiError(),
    );
  }

  resubmitDocuments(files: Partial<Record<DocumentType, File>>, clinicId?: string): Observable<void> {
    const id = clinicId ?? this.tokens.clinicId();
    if (!id) return throwError(() => new ApiError('CLINIC_CONTEXT_REQUIRED', 'Elige primero con qué clínica vas a trabajar.', 403));
    const types = (Object.keys(files) as DocumentType[]).filter((t) => files[t]);
    return this.uploadDocuments(`${VET_API}/${id}/verification/documents`, types, { documents: files }).pipe(
      switchMap(() => this.http.post(`${VET_API}/${id}/verification/submit`, { truthfulnessDeclared: true, includeProfessionalProfile: false })),
      // Deja la lista de clínicas al día (el selector muestra el estado nuevo).
      switchMap(() => this.context.loadClinics().pipe(catchError(() => of([])))),
      tap(() => this.session.patchClinic({ status: 'UNDER_REVIEW' })),
      map(() => undefined),
      mapApiError(),
    );
  }

  // ---- Pasos del envío ----

  /** Crea la clínica, o reutiliza la que quedó a medias en un intento anterior. */
  private ensureClinic({ clinic }: RegistrationSubmission): Observable<RegisteredClinic> {
    const pending = this.pending()[clinic.nit];
    if (pending) return of(pending);
    const body = {
      name: clinic.name,
      legalName: clinic.legalName,
      nit: `${clinic.nit}-${clinic.nitDv}`,
      phone: `+57${clinic.phone}`,
      email: clinic.email,
      department: clinic.department,
      city: clinic.city,
      address: clinic.address,
      ...(clinic.latitude !== null && clinic.longitude !== null ? { latitude: clinic.latitude, longitude: clinic.longitude } : {}),
      acceptedDataPolicyVersion: environment.legal.dataPolicyVersion,
      acceptedTermsVersion: environment.legal.termsVersion,
    };
    return this.http.post<{ id: string; name: string }>(`${VET_API}/register`, body).pipe(
      map((res) => ({ id: res.id, name: res.name ?? clinic.name })),
      tap((created) => this.savePending(clinic.nit, created)),
    );
  }

  /** Pide el token de clínica (el asistente de verificación lo exige). */
  private enterClinic(clinic: RegisteredClinic): Observable<AccountClinic> {
    return this.context.enter({ veterinaryId: clinic.id, veterinaryName: clinic.name, role: 'OWNER', status: 'PENDING_DOCUMENTS' });
  }

  private putLegalRep(clinic: AccountClinic, { legalRep }: RegistrationSubmission): Observable<unknown> {
    const isOwner = legalRep.isSelf === 'yes';
    return this.http.put(`${VET_API}/${clinic.veterinaryId}/legal-representative`, {
      // Cuerpo real del servicio (GUIA_INTEGRACION_FRONTEND §2c, paso 1).
      isOwner,
      fullName: legalRep.fullName,
      documentType: legalRep.documentType,
      documentNumber: legalRep.documentNumber,
    });
  }

  /** El logo es opcional: si falla no se detiene el envío (se puede subir después en Mi clínica). */
  private uploadLogo(clinic: AccountClinic, logo: File | null): Observable<unknown> {
    if (!logo) return of(null);
    return this.clinicApi.uploadLogo(clinic.veterinaryId, logo).pipe(catchError(() => of(null)));
  }

  private professionalProfile({ account, legalRep, profile, documents }: RegistrationSubmission): Observable<unknown> {
    const self = legalRep.isSelf === 'yes';
    const body = {
      fullName: account.fullName,
      documentType: self ? legalRep.documentType : profile.idType,
      documentNumber: self ? legalRep.documentNumber : profile.idNumber,
      licenseNumber: profile.licenseNumber,
      profession: profile.profession,
      ...(profile.specialty ? { specialty: profile.specialty } : {}),
      ...(profile.university ? { university: profile.university } : {}),
    };
    return this.http
      .put(`${VET_API}/me/professional-profile`, body)
      .pipe(switchMap(() => this.uploadDocuments(`${VET_API}/me/professional-profile/documents`, PROFILE_DOCUMENTS, { documents } as RegistrationSubmission)));
  }

  /** Sube de a uno, en orden, los documentos que haya. Subir el mismo tipo otra vez lo reemplaza (reintentos). */
  private uploadDocuments(url: string, types: readonly DocumentType[], { documents }: Pick<RegistrationSubmission, 'documents'>): Observable<unknown[]> {
    const present = types.filter((t) => documents[t]);
    return from(present).pipe(
      concatMap((type) => {
        const form = new FormData();
        // Mismo orden que la colección que usa el equipo de backend: primero el tipo, después el archivo.
        form.append('documentType', type);
        const file = documents[type]!;
        // Nombre simple (sin tildes, espacios ni símbolos): el servicio lo usa para guardar el archivo.
        const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
        form.append('file', file, `${type.toLowerCase()}${ext ? `.${ext}` : ''}`);
        return this.http.post(url, form);
      }),
      toArray(),
    );
  }

  private receipt(clinic: AccountClinic, res: SubmitResponse): RegistrationReceipt {
    return {
      requestId: res.requestId,
      veterinaryId: clinic.veterinaryId,
      veterinaryName: clinic.veterinaryName,
      userId: this.session.user()?.userId ?? '',
      status: 'UNDER_REVIEW',
      submittedAt: res.submittedAt ?? new Date().toISOString(),
    };
  }

  private signInAfterVerify(email: string): Observable<void> {
    if (this.tokens.hasSession() || !this.password) return of(undefined);
    const password = this.password;
    return defer(() => this.login.login({ email, password })).pipe(
      tap(() => (this.password = null)),
      map(() => undefined),
      // Si no entra, la verificación sí quedó hecha: al enviar se le pedirá iniciar sesión.
      catchError(() => of(undefined)),
    );
  }

  // ---- Clínica a medias (por NIT) ----

  private pending(): Record<string, RegisteredClinic> {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}') as Record<string, RegisteredClinic>;
    } catch {
      return {};
    }
  }

  private savePending(nit: string, clinic: RegisteredClinic): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ ...this.pending(), [nit]: clinic }));
    } catch {
      /* sin storage */
    }
  }

  private forgetPending({ clinic }: RegistrationSubmission): void {
    const { [clinic.nit]: _done, ...rest } = this.pending();
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(rest));
    } catch {
      /* sin storage */
    }
  }
}

/** Estados de la solicitud del backend → los de la pantalla de estado. */
function toStatus(raw?: string): VerificationStatus {
  switch (raw) {
    case 'NEEDS_CORRECTION':
    case 'REJECTED':
    case 'DRAFT':
      return raw;
    case 'PENDING_DOCUMENTS':
      return 'DRAFT';
    case 'APPROVED':
    case 'ACTIVE':
      return 'ACTIVE';
    default:
      return 'UNDER_REVIEW';
  }
}
