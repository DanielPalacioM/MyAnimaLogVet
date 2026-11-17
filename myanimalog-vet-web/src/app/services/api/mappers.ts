import { ClinicRole } from '@auth/models/session.models';
import { Client, ClinicProfile, Invitation, LicenseState, Member, MemberRole, Patient, ROLE_LABEL, Species } from '../clinic/clinic.models';
import { ClientDto, PatientDto } from './link.api';
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

const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const SPECIES: Record<string, Species> = { DOG: 'Perro', CAT: 'Gato', PERRO: 'Perro', GATO: 'Gato' };

/** El backend manda la especie en inglés (`DOG`) o como la escribió el dueño; el panel agrupa en Perro, Gato y Otro. */
export const speciesFrom = (raw: string | null | undefined): Species => SPECIES[(raw ?? '').trim().toUpperCase()] ?? 'Otro';

/** "2 años", "5 meses" a partir de la fecha de nacimiento (solo viene en el detalle del paciente). */
export function ageFrom(birthDate: string | null | undefined, now = Date.now()): string {
  if (!birthDate) return '—';
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return '—';
  const n = new Date(now);
  const months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
  if (months < 1) return 'Menos de 1 mes';
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const y = Math.floor(months / 12);
  return y === 1 ? '1 año' : `${y} años`;
}

export const sexFrom = (raw: string | null | undefined): string | undefined => {
  const s = (raw ?? '').trim().toUpperCase();
  return s === 'MALE' || s === 'MACHO' ? 'Macho' : s === 'FEMALE' || s === 'HEMBRA' ? 'Hembra' : undefined;
};

/** Completa a un paciente con lo que solo trae el detalle: sexo, fecha de nacimiento (edad) y foto. */
export function withDetail(p: Patient, dto: PatientDto, now = Date.now()): Patient {
  return {
    ...p,
    breed: dto.breed ?? p.breed,
    age: ageFrom(dto.birthDate, now),
    sex: sexFrom(dto.sex) ?? p.sex,
    birthDate: dto.birthDate ?? p.birthDate,
    photoUrl: dto.photoUrl ?? p.photoUrl,
  };
}

/** Mascota compartida → fila de Pacientes. Lo que el backend aún no da (visitas, vacunas) queda "Sin registro". */
export function patientFrom(dto: PatientDto, ownerName: string): Patient {
  return {
    id: dto.petId,
    name: dto.name,
    species: speciesFrom(dto.species),
    breed: dto.breed ?? '',
    age: ageFrom(dto.birthDate),
    owner: ownerName,
    ownerId: dto.ownerUserId,
    photoUrl: dto.photoUrl,
    phone: '',
    lastVisit: 'Sin visitas',
    lastVisitService: '—',
    lastVisitAt: 0,
    vaccines: 'NONE',
    inApp: true,
  };
}

/** Dueño vinculado → cliente. Su teléfono no llega del backend; las mascotas son las que compartió. */
export function clientFrom(dto: ClientDto, pets: Patient[]): Client {
  const name = dto.name?.trim() || dto.email || 'Sin nombre';
  return {
    id: dto.userId,
    name,
    initials: initialsOf(name),
    email: dto.email ?? '',
    phone: '',
    pets,
    linkedAt: ms(dto.linkedAt),
    via: 'QR',
    lastVisit: 'Sin visitas',
    lastVisitAt: 0,
    next: null,
  };
}
