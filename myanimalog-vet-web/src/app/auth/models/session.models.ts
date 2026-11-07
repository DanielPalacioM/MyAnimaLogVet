/** Estados de una clínica en el veterinary-service. */
export type ClinicStatus = 'PENDING_DOCUMENTS' | 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

/** Rol de la persona dentro de la clínica (del backend). */
export type ClinicRole = 'OWNER' | 'ADMIN' | 'VETERINARIAN' | 'ASSISTANT' | 'RECEPTIONIST';

/** Una clínica donde la persona es empleada activa (`GET /api/veterinary/me`). */
export interface ClinicSummary {
  veterinaryId: string;
  veterinaryName: string;
  city?: string;
  role?: ClinicRole;
  status: ClinicStatus;
}

/** La clínica con la que se está trabajando. */
export interface AccountClinic extends ClinicSummary {
  /** Datos de la solicitud de verificación, si se conocen. */
  requestId?: string;
  submittedAt?: string;
}

export interface AccountUser {
  userId: string;
  fullName: string;
  email: string;
  clinic: AccountClinic | null;
  /** `PLATFORM_ADMIN` = equipo de MyAnimaLog. */
  platformRole?: 'USER' | 'PLATFORM_ADMIN';
}
