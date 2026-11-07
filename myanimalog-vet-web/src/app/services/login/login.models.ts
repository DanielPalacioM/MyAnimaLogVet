import { AccountUser, ClinicSummary } from '@auth/models/session.models';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  user: AccountUser;
  /** Clínicas de la persona. Si solo hay una, `user.clinic` ya viene elegida. */
  clinics: ClinicSummary[];
}
