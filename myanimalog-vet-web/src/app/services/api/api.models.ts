import { ClinicRole, ClinicStatus } from '@auth/models/session.models';

/** Perfil de la clínica (`GET /api/veterinary/{id}`). */
export interface ClinicProfileDto {
  id: string;
  name: string;
  legalName?: string;
  nit?: string;
  email: string;
  phone: string;
  department?: string;
  city: string;
  address?: string;
  status: ClinicStatus;
  active?: boolean;
  logoUrl?: string | null;
  timezone?: string;
  currency?: string;
  defaultAppointmentMinutes: number;
  allowOnlineBooking: boolean;
  bookingRequiresConfirmation: boolean;
  cancellationMinHours: number;
  directoryVisible: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  /** Si el backend lo incluye en el perfil. Si no, solo se conoce al generarlo. */
  inviteCode?: string | null;
  inviteLink?: string | null;
}

export interface ClinicDataPatch {
  name?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface ClinicSettingsPatch {
  timezone?: string;
  currency?: string;
  defaultAppointmentMinutes?: number;
  allowOnlineBooking?: boolean;
  bookingRequiresConfirmation?: boolean;
  cancellationMinHours?: number;
  directoryVisible?: boolean;
}

export interface InviteCodeDto {
  veterinaryId: string;
  inviteCode: string | null;
  inviteLink: string | null;
}

export interface SubscriptionDto {
  id: string;
  veterinaryId: string;
  plan: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface EmployeeDto {
  employeeId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: ClinicRole;
  active: boolean;
  createdAt: string;
  removedAt: string | null;
  self: boolean;
}

export type LicenseStatusDto = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Vista reducida del perfil profesional de un colega. */
export interface ColleagueProfileDto {
  fullName: string;
  profession: string;
  licenseNumber: string;
  specialty?: string | null;
  university?: string | null;
  licenseStatus: LicenseStatusDto;
}

export type InvitationStatusDto = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
export type InvitableRole = 'ADMIN' | 'VETERINARIAN' | 'ASSISTANT' | 'RECEPTIONIST';

export interface InvitationDto {
  id: string;
  veterinaryId?: string;
  email: string;
  role: ClinicRole;
  status: InvitationStatusDto;
  expired: boolean;
  invitedBy?: string;
  expiresAt: string;
  decidedAt?: string | null;
  createdAt?: string;
}

/** Invitación dirigida a mi correo (`GET /me/invitations`). No trae el token. */
export interface MyInvitationDto {
  invitationId: string;
  veterinaryId: string;
  veterinaryName: string | null;
  veterinaryCity?: string | null;
  logoUrl?: string | null;
  role: ClinicRole;
  expiresAt: string;
}

export interface InvitationPreviewDto {
  invitationId: string;
  veterinaryId: string;
  veterinaryName: string | null;
  veterinaryCity?: string | null;
  logoUrl?: string | null;
  role: ClinicRole;
  invitedByName?: string | null;
  email: string;
  emailMatchesCaller: boolean;
  status: InvitationStatusDto;
  expired: boolean;
  usable: boolean;
  expiresAt: string;
}

export interface InvitationAcceptedDto {
  employeeId: string;
  veterinaryId: string;
  veterinaryName: string;
  role: ClinicRole;
  licensed: boolean;
  reactivated: boolean;
}

export interface OwnershipTransferDto {
  veterinaryId: string;
  previousOwner: { employeeId: string; userId: string; role: ClinicRole };
  newOwner: { employeeId: string; userId: string; role: ClinicRole };
  legalRepresentativeChanged: boolean;
}
