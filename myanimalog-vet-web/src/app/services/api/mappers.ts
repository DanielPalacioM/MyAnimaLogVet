import { ClinicRole } from '@auth/models/session.models';
import { ClinicProfile, Invitation, LicenseState, Member, MemberRole, ROLE_LABEL } from '../clinic/clinic.models';
import { ClinicProfileDto, ColleagueProfileDto, EmployeeDto, InvitableRole, InvitationDto, LicenseStatusDto } from './api.models';

const ROLE_FROM_API: Record<ClinicRole, MemberRole> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  VETERINARIAN: 'VET',
  ASSISTANT: 'ASSISTANT',
  RECEPTIONIST: 'RECEPTION',
};

const ROLE_TO_API: Record<Exclude<MemberRole, 'OWNER'>, InvitableRole> = {
  ADMIN: 'ADMIN',
  VET: 'VETERINARIAN',
  ASSISTANT: 'ASSISTANT',
  RECEPTION: 'RECEPTIONIST',
};

export const roleFromApi = (role: ClinicRole): MemberRole => ROLE_FROM_API[role] ?? 'ASSISTANT';
export const roleToApi = (role: Exclude<MemberRole, 'OWNER'>): InvitableRole => ROLE_TO_API[role];

/** Los roles que escriben historia clínica tienen tarjeta profesional; los demás "no aplica". */
export const hasProfessionalProfile = (role: MemberRole): boolean => role === 'OWNER' || role === 'ADMIN' || role === 'VET';

export function licenseFrom(status: LicenseStatusDto | null | undefined, role: MemberRole): LicenseState {
  if (!hasProfessionalProfile(role)) return 'NA';
  if (status === 'VERIFIED') return 'VERIFIED';
  if (status === 'PENDING') return 'IN_REVIEW';
  if (status === 'REJECTED') return 'REJECTED';
  return 'MISSING';
}

const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : 0);

export function memberFrom(dto: EmployeeDto, profile: ColleagueProfileDto | null): Member {
  const role = roleFromApi(dto.role);
  return {
    id: dto.employeeId,
    userId: dto.userId,
    self: dto.self,
    name: dto.name ?? dto.email ?? 'Sin nombre',
    email: dto.email ?? '',
    role,
    roleLabel: ROLE_LABEL[role],
    license: licenseFrom(profile?.licenseStatus, role),
    active: dto.active,
    joinedAt: ms(dto.createdAt),
    profession: profile?.profession,
    card: profile?.licenseNumber,
    specialty: profile?.specialty ?? undefined,
    university: profile?.university ?? undefined,
    schedule: '',
  };
}

export function invitationFrom(dto: InvitationDto, nameByUserId: Map<string, string>): Invitation {
  return {
    id: dto.id,
    email: dto.email,
    role: roleFromApi(dto.role),
    invitedBy: (dto.invitedBy && nameByUserId.get(dto.invitedBy)) || '',
    sentAt: ms(dto.createdAt),
    expiresAt: ms(dto.expiresAt),
    expired: dto.expired,
  };
}

export function profileFrom(dto: ClinicProfileDto): ClinicProfile {
  return {
    name: dto.name,
    phone: dto.phone,
    email: dto.email,
    city: dto.city,
    department: dto.department ?? '',
    address: dto.address ?? '',
    legalName: dto.legalName ?? '',
    nit: dto.nit ?? '',
    logoUrl: dto.logoUrl ?? null,
    status: dto.status,
    suspensionReason: dto.suspensionReason ?? null,
    onlineBooking: dto.allowOnlineBooking,
    confirmEach: dto.bookingRequiresConfirmation,
    minCancelHours: dto.cancellationMinHours,
    defaultMinutes: dto.defaultAppointmentMinutes,
    inDirectory: dto.directoryVisible,
  };
}
