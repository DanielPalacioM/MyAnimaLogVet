import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccountInput,
  ClinicAvailability,
  DocumentType,
  ClinicAvailabilityQuery,
  RegistrationReceipt,
  RegistrationSubmission,
  VerificationStatus,
} from './models/registration.model';

/** Un documento de la solicitud, tal como lo informa `GET /{id}/verification`. */
export interface VerificationDocument {
  type: DocumentType;
  required: boolean;
  /** `PENDING` sin subir · `READY` subido · `NEEDS_CORRECTION` pedido por el revisor · `REVIEWED` ya aprobado. */
  status: 'PENDING' | 'READY' | 'NEEDS_CORRECTION' | 'REVIEWED';
  fileName: string | null;
}

export interface VerificationSummary {
  requestId: string;
  status: VerificationStatus;
  /** ISO 8601. */
  submittedAt: string;
  /** Nota del revisor (corrección o rechazo). */
  note?: string | null;
  attemptsRemaining?: number;
  maxAttempts?: number;
  documents?: VerificationDocument[];
}

/**
 * Servicio del registro de la clínica. Hoy lo implementa el mock; luego una versión HTTP
 * (`/api/veterinary/register`, `/veterinaries/{id}/verification/*`; ver docs/MYANIMALOG_VET_REGISTRO.md §7).
 * Se elige la implementación en `register.module.ts` (providers).
 */
@Injectable()
export abstract class RegisterService {
  /** Crea la cuenta del dueño. Error: `EMAIL_TAKEN`. */
  abstract createAccount(input: AccountInput): Observable<{ userId: string }>;

  /** Envía el código de 6 dígitos al correo. Devuelve los segundos antes de poder reenviar. */
  abstract sendVerificationCode(email: string): Observable<{ resendAfterSeconds: number }>;

  /** Error: `INVALID_CODE`. */
  abstract verifyEmail(email: string, code: string): Observable<void>;

  /** Nombre, NIT y correo de clínica son únicos (REGISTRO §5.5). */
  abstract checkClinicAvailability(query: ClinicAvailabilityQuery): Observable<ClinicAvailability>;

  /**
   * Envía la clínica a verificación (`UNDER_REVIEW`).
   * Errores: `EMAIL_NOT_VERIFIED`, `TOO_MANY_CLINICS`, `CLINIC_TAKEN`, `DOCUMENTS_MISSING`.
   */
  abstract submitRegistration(submission: RegistrationSubmission): Observable<RegistrationReceipt>;

  /** Estado de la solicitud. `clinicId` sirve cuando no hay token de clínica (p. ej. una clínica rechazada). */
  abstract getVerification(requestId: string, clinicId?: string): Observable<VerificationSummary>;

  /** Abre un intento nuevo de una solicitud rechazada (`POST /verification/retry`). Hay que volver a subir los documentos. */
  abstract retryVerification(clinicId?: string): Observable<void>;

  /** Sube solo los documentos dados y reenvía a revisión (corrección, o intento nuevo después de reintentar). */
  abstract resubmitDocuments(files: Partial<Record<DocumentType, File>>, clinicId?: string): Observable<void>;
}
