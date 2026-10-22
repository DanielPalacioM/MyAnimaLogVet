import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccountInput,
  ClinicAvailability,
  ClinicAvailabilityQuery,
  RegistrationReceipt,
  RegistrationSubmission,
  VerificationStatus,
} from './models/registration.model';

export interface VerificationSummary {
  requestId: string;
  status: VerificationStatus;
  /** ISO 8601. */
  submittedAt: string;
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

  abstract getVerification(requestId: string): Observable<VerificationSummary>;
}
