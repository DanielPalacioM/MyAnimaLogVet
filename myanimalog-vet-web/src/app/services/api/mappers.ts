import { ClinicRole } from '@auth/models/session.models';
import {
  Appointment,
  AppointmentStatus,
  Client,
  ClinicBlock,
  ClinicProfile,
  ClinicService,
  ScheduleDay,
  Invitation,
  LicenseState,
  Member,
  MemberRole,
  NewPatient,
  Patient,
  ROLE_LABEL,
  ServiceCategory,
  Species,
} from '../clinic/clinic.models';
import { AppointmentDto } from './calendar.api';
import { ServiceDto } from './catalog.api';
import { BusinessHourDto, ScheduleBlockBody, ScheduleBlockDto } from './schedule.api';
import { ClientDto, NewPatientBody, PatientDto } from './link.api';
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

/** Cuerpo para registrar una mascota sin app (contrato propuesto, ver `LinkApi.registerPatient`). */
export function patientBodyFrom(input: NewPatient): NewPatientBody {
  const species = input.species === 'Perro' ? 'DOG' : input.species === 'Gato' ? 'CAT' : 'OTHER';
  const phone = input.ownerPhone?.trim();
  return {
    name: input.name.trim(),
    species,
    breed: input.breed.trim(),
    ...(input.birthDate ? { birthDate: input.birthDate } : {}),
    ...(input.sex ? { sex: input.sex === 'Macho' ? ('MALE' as const) : ('FEMALE' as const) } : {}),
    owner: { fullName: input.ownerName.trim(), email: input.ownerEmail.trim().toLowerCase(), ...(phone ? { phone } : {}) },
  };
}

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
    weight: dto.weight ?? p.weight,
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

const CATEGORIES: ServiceCategory[] = ['Consulta', 'Vacunación', 'Estética', 'Laboratorio', 'Cirugía', 'Otro'];
const CATEGORY_ALIAS: Record<string, ServiceCategory> = {
  CONSULTATION: 'Consulta',
  VACCINATION: 'Vacunación',
  GROOMING: 'Estética',
  AESTHETICS: 'Estética',
  LAB: 'Laboratorio',
  LABORATORY: 'Laboratorio',
  SURGERY: 'Cirugía',
  OTHER: 'Otro',
};

/** Categoría del backend (en español o en inglés) → la del panel. Si no se reconoce: "Otro". */
export function categoryFrom(raw: string | null | undefined): ServiceCategory {
  const text = (raw ?? '').trim();
  return CATEGORIES.find((c) => c.toLowerCase() === text.toLowerCase()) ?? CATEGORY_ALIAS[text.toUpperCase()] ?? 'Otro';
}

/** Categoría del panel → la que se manda al backend (en inglés, como el resto de enums). */
export const categoryToApi = (c: ServiceCategory): string =>
  ({ Consulta: 'CONSULTATION', Vacunación: 'VACCINATION', Estética: 'GROOMING', Laboratorio: 'LAB', Cirugía: 'SURGERY', Otro: 'OTHER' })[c];

/** Servicio del backend → fila del catálogo. Si no dice quién lo presta, `professionalIds` queda vacío (= todos). */
export function serviceFrom(dto: ServiceDto): ClinicService {
  return {
    id: dto.id,
    name: dto.name,
    category: categoryFrom(dto.category),
    minutes: dto.durationMinutes ?? dto.duration_minutes ?? 30,
    price: dto.price ?? 0,
    online: dto.bookableOnline ?? dto.bookable_online ?? false,
    active: dto.active ?? true,
    professionalIds: dto.employeeIds ?? dto.professionalIds ?? [],
  };
}

const hhmm = (raw: string): string => raw.slice(0, 5);

/** Tramos del backend (lunes = 1) → los 7 días del panel (lunes = 0). Un día sin tramos queda cerrado. */
export function scheduleFrom(rows: BusinessHourDto[]): ScheduleDay[] {
  return Array.from({ length: 7 }, (_, day) => {
    const ranges = rows
      .filter((r) => r.dayOfWeek === day + 1)
      .map((r): [string, string] => [hhmm(r.opensAt ?? r.startsAt ?? ''), hhmm(r.closesAt ?? r.endsAt ?? '')])
      .filter(([a, b]) => a && b)
      .sort((x, y) => x[0].localeCompare(y[0]));
    return { day, open: ranges.length > 0, ranges };
  });
}

/** Días del panel → tramos para guardar (solo los abiertos). */
export const scheduleToApi = (days: ScheduleDay[]) =>
  days.flatMap((d) => (d.open ? d.ranges.map(([opensAt, closesAt]) => ({ dayOfWeek: d.day + 1, opensAt, closesAt })) : []));

const DAY_MS = 86_400_000;
const startOfLocalDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Bloqueo del backend (instantes) → bloqueo del panel. Si empieza y termina a medianoche, es de días completos
 * (el último día es el anterior al fin); si no, es de un solo día con horas.
 */
export function blockFrom(dto: ScheduleBlockDto): ClinicBlock {
  const start = ms(dto.startsAt);
  const end = ms(dto.endsAt);
  const date = startOfLocalDay(start);
  const wholeDays = start === date && end === startOfLocalDay(end) && end > start;
  const lastDay = startOfLocalDay(end - 1);
  const time = (t: number) => `${String(new Date(t).getHours()).padStart(2, '0')}:${String(new Date(t).getMinutes()).padStart(2, '0')}`;
  return {
    id: dto.id,
    title: dto.title ?? dto.reason ?? 'Bloqueo',
    date,
    endDate: wholeDays && lastDay > date ? lastDay : undefined,
    scope: dto.employeeId ?? 'CLINIC',
    allDay: wholeDays,
    from: wholeDays ? undefined : time(start),
    to: wholeDays ? undefined : time(end),
  };
}

/** Bloqueo del panel → cuerpo para guardar: instantes, con la medianoche del día siguiente como fin si es de días completos. */
export function blockToApi(b: Omit<ClinicBlock, 'id'>): ScheduleBlockBody {
  const at = (day: number, t: string) => {
    const d = new Date(day);
    const [h, m] = t.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const startsAt = b.allDay ? b.date : at(b.date, b.from ?? '00:00');
  const endsAt = b.allDay ? startOfLocalDay((b.endDate ?? b.date) + DAY_MS + 3_600_000) : at(b.date, b.to ?? '23:59');
  return { employeeId: b.scope === 'CLINIC' ? null : b.scope, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), reason: b.title };
}

const STATUSES: AppointmentStatus[] = ['REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

/** `REJECTED` (la clínica rechazó la solicitud) se muestra como cancelada: el panel no tiene un estado aparte. */
export const appointmentStatusFrom = (raw: string): AppointmentStatus => {
  const s = (raw ?? '').toUpperCase();
  return STATUSES.find((x) => x === s) ?? (s === 'REJECTED' ? 'CANCELLED' : 'REQUESTED');
};

/**
 * Cita del backend → cita del panel. El nombre de la mascota y el servicio salen de lo que mande la cita o, si no,
 * de los pacientes y del catálogo que el panel ya cargó (se cruzan por `petId` y `serviceId`).
 */
export function appointmentFrom(dto: AppointmentDto, patients: Patient[], catalog: ClinicService[]): Appointment {
  const petId = dto.petId ?? dto.pet?.id ?? '';
  const serviceId = dto.serviceId ?? dto.service?.id ?? '';
  const patient = patients.find((p) => p.id === petId);
  const service = catalog.find((s) => s.id === serviceId);
  const start = ms(dto.startsAt);
  const end = ms(dto.endsAt);
  return {
    id: dto.id,
    patientId: petId,
    patientName: patient?.name ?? dto.petName ?? dto.pet?.name ?? 'Mascota',
    service: dto.serviceName ?? dto.service?.name ?? service?.name ?? 'Servicio',
    serviceId: serviceId || undefined,
    price: dto.price ?? dto.service?.price ?? service?.price,
    professionalId: dto.employeeId ?? dto.employee?.id ?? '',
    start,
    minutes: end > start ? Math.round((end - start) / 60_000) : (dto.durationMinutes ?? dto.service?.durationMinutes ?? service?.minutes ?? 30),
    status: appointmentStatusFrom(dto.status),
    source: (dto.origin ?? '').toUpperCase() === 'APP' ? 'APP' : 'CLINIC',
    note: dto.notes?.trim() || undefined,
  };
}
