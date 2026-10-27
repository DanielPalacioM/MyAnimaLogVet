import { computed, Injectable, signal } from '@angular/core';
import { buildAppointments, buildPatients, PROFESSIONALS, TODAY } from './clinic.seed';
import { buildBlocks, buildInvitations, CATALOG, CLIENT_OVERRIDES, MEMBERS, PROFILE, SCHEDULE } from './clinic-settings.seed';
import {
  Appointment,
  AppointmentStatus,
  Client,
  ClinicBlock,
  ClinicProfile,
  ClinicService,
  Invitation,
  isActive,
  Member,
  MemberRole,
  NewAppointment,
  NewPatient,
  Patient,
  ROLE_LABEL,
  ScheduleDay,
} from './clinic.models';
import { at, sameDay, startOfDay } from './date.utils';

const DAY = 86_400_000;
const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const initialsOf = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Datos de prueba de la clínica (pacientes, citas, equipo, servicios, horario, perfil). Hoy viven en memoria y se
 * reinician al recargar; al conectar el backend, esta clase se reemplaza por llamadas HTTP y las vistas no cambian.
 */
@Injectable({ providedIn: 'root' })
export class ClinicStore {
  readonly professionals = PROFESSIONALS;

  readonly patients = signal<Patient[]>(buildPatients(TODAY()));
  readonly appointments = signal<Appointment[]>(buildAppointments(TODAY(), this.patients()));
  /** Pacientes a los que ya se les avisó por la vacuna vencida (se quitan de "Por resolver"). */
  readonly notifiedVaccines = signal<ReadonlySet<string>>(new Set());
  /** Reloj en ms (se actualiza cada minuto) para "próxima cita" y la línea de "ahora". */
  readonly now = signal(Date.now());

  // ---- Equipo ----
  readonly members = signal<Member[]>(MEMBERS);
  readonly invitations = signal<Invitation[]>(buildInvitations(Date.now()));

  // ---- Servicios y horarios ----
  readonly catalog = signal<ClinicService[]>(CATALOG);
  readonly schedule = signal<ScheduleDay[]>(SCHEDULE);
  readonly blocks = signal<ClinicBlock[]>(buildBlocks(TODAY()));

  // ---- Mi clínica ----
  readonly profile = signal<ClinicProfile>(PROFILE);
  /** Código para vincular dueños en recepción (QR). */
  readonly linkCode = signal<string | null>('PATI-7K2Q');

  /** Servicios que se pueden agendar (los activos). */
  get services(): ClinicService[] {
    return this.catalog().filter((s) => s.active);
  }

  readonly todayAppointments = computed(() =>
    this.appointments()
      .filter((a) => sameDay(a.start, this.now()))
      .sort((a, b) => a.start - b.start),
  );
  readonly todayActiveCount = computed(() => this.todayAppointments().filter(isActive).length);
  readonly pendingRequests = computed(() => this.appointments().filter((a) => a.status === 'REQUESTED' && a.source === 'APP'));
  readonly overdueVaccines = computed(() => this.patients().filter((p) => p.vaccines === 'OVERDUE'));
  readonly vaccinesToNotify = computed(() => this.overdueVaccines().filter((p) => !this.notifiedVaccines().has(p.id)));

  /** Invitaciones que aún se pueden aceptar. */
  readonly pendingInvitations = computed(() => this.invitations().filter((i) => i.expiresAt > this.now()));

  /** Dueños con al menos una mascota compartida con la clínica. */
  readonly clients = computed<Client[]>(() => {
    const byOwner = new Map<string, Patient[]>();
    for (const p of this.patients()) {
      if (!p.inApp) continue;
      const list = byOwner.get(p.owner);
      if (list) list.push(p);
      else byOwner.set(p.owner, [p]);
    }
    const now = this.now();
    const today = startOfDay(now);
    const appointments = this.appointments();
    return [...byOwner.entries()].map(([owner, pets]): Client => {
      const h = hash(owner);
      const over = CLIENT_OVERRIDES[owner];
      const last = pets.reduce((a, b) => (b.lastVisitAt > a.lastVisitAt ? b : a));
      const ids = new Set(pets.map((p) => p.id));
      const next =
        appointments
          .filter((a) => ids.has(a.patientId) && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && a.start + a.minutes * 60_000 >= now)
          .sort((a, b) => a.start - b.start)[0] ?? null;
      const claimed = h % 5 === 0 ? pets[0].name : undefined;
      return {
        id: slug(owner),
        name: owner,
        initials: initialsOf(owner),
        email: over?.email ?? `${slug(owner.split(' ')[0])}.${slug(owner.split(' ').slice(-1)[0])}@correo.com`,
        phone: pets[0].phone,
        pets,
        linkedAt: over?.linkedAt ?? today - (10 + (h % 320)) * DAY,
        via: over ? over.via : claimed ? 'CLAIM' : 'QR',
        claimedPet: over ? over.claimedPet : claimed,
        lastVisit: last.lastVisit,
        lastVisitAt: last.lastVisitAt,
        next,
      };
    });
  });

  constructor() {
    setInterval(() => this.now.set(Date.now()), 60_000);
  }

  patient(id: string): Patient | undefined {
    return this.patients().find((p) => p.id === id);
  }

  professional(id: string) {
    return this.professionals.find((p) => p.id === id);
  }

  // ---- Citas ----

  /** ¿El profesional ya tiene una cita activa que se cruce con este horario? */
  hasConflict(professionalId: string, start: number, minutes: number, ignoreId?: string): boolean {
    const end = start + minutes * 60_000;
    return this.appointments().some(
      (a) =>
        a.id !== ignoreId &&
        a.professionalId === professionalId &&
        isActive(a) &&
        a.start < end &&
        start < a.start + a.minutes * 60_000,
    );
  }

  addAppointment(input: NewAppointment): Appointment {
    const patient = this.patient(input.patientId)!;
    const appointment: Appointment = {
      id: `a-${Date.now()}`,
      patientName: patient.name,
      status: 'CONFIRMED',
      source: 'CLINIC',
      ...input,
    };
    this.appointments.update((list) => [...list, appointment]);
    return appointment;
  }

  setStatus(id: string, status: AppointmentStatus): void {
    this.appointments.update((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  /**
   * ¿La clínica atiende en ese horario? Devuelve el motivo si no: cerrado, fuera de horario o bloqueado
   * (por un bloqueo de toda la clínica o del profesional).
   */
  unavailableReason(start: number, minutes: number, professionalId?: string): string | null {
    const d = new Date(start);
    const day = this.schedule().find((s) => s.day === (d.getDay() + 6) % 7);
    if (!day?.open) return 'Cerrado';
    const from = d.getHours() * 60 + d.getMinutes();
    const to = from + minutes;
    if (!day.ranges.some(([a, b]) => from >= toMin(a) && to <= toMin(b))) return 'Fuera de horario';
    const end = start + minutes * 60_000;
    const blocked = this.blocks().some((b) => {
      if (b.scope !== 'CLINIC' && b.scope !== professionalId) return false;
      const first = b.date;
      const lastDay = b.endDate ?? b.date;
      const from = b.allDay ? first : at(first, b.from ?? '00:00');
      const until = b.allDay ? lastDay + DAY : at(first, b.to ?? '23:59');
      return from < end && start < until;
    });
    return blocked ? 'Bloqueado' : null;
  }

  // ---- Pacientes y clientes ----

  addPatient(input: NewPatient): Patient {
    const patient: Patient = {
      id: `p-${Date.now()}`,
      ...input,
      lastVisit: 'Sin visitas',
      lastVisitService: '—',
      lastVisitAt: 0,
      vaccines: 'NONE',
      inApp: false,
    };
    this.patients.update((list) => [patient, ...list]);
    return patient;
  }

  /** Quita al cliente: la clínica pierde el acceso a todas sus mascotas. */
  removeClient(owner: string): void {
    this.patients.update((list) => list.map((p) => (p.owner === owner ? { ...p, inApp: false } : p)));
  }

  // ---- Pendientes ----

  notifyVaccine(patientId: string): void {
    this.notifiedVaccines.update((s) => new Set(s).add(patientId));
  }

  // ---- Equipo ----

  /** Devuelve el motivo si no se puede invitar. */
  invite(email: string, role: MemberRole, invitedBy: string): string | null {
    const e = email.trim().toLowerCase();
    if (this.members().some((m) => m.email.toLowerCase() === e)) return 'Esa persona ya está en tu equipo.';
    if (this.pendingInvitations().some((i) => i.email.toLowerCase() === e)) return 'Ya tiene una invitación pendiente. Puedes reenviarla.';
    const now = Date.now();
    // Si había una vencida para el mismo correo, se reemplaza.
    this.invitations.update((list) => [...list.filter((i) => i.email.toLowerCase() !== e), { id: `i-${now}`, email: e, role, invitedBy, sentAt: now, expiresAt: now + 7 * DAY }]);
    return null;
  }

  resendInvitation(id: string): void {
    const now = Date.now();
    this.invitations.update((list) => list.map((i) => (i.id === id ? { ...i, sentAt: now, expiresAt: now + 7 * DAY } : i)));
  }

  cancelInvitation(id: string): void {
    this.invitations.update((list) => list.filter((i) => i.id !== id));
  }

  changeRole(memberId: string, role: MemberRole): void {
    this.members.update((list) =>
      list.map((m) => {
        if (m.id !== memberId) return m;
        const female = /a$/i.test(m.roleLabel);
        const label = role === 'VET' ? (female ? 'Veterinaria' : 'Veterinario') : ROLE_LABEL[role];
        return { ...m, role, roleLabel: label };
      }),
    );
  }

  setMemberActive(memberId: string, active: boolean): void {
    this.members.update((list) => list.map((m) => (m.id === memberId ? { ...m, active } : m)));
  }

  setMemberSchedule(memberId: string, schedule: string): void {
    this.members.update((list) => list.map((m) => (m.id === memberId ? { ...m, schedule } : m)));
  }

  /** La dueña actual pasa a administradora y el miembro elegido queda como dueño. */
  transferOwnership(memberId: string): void {
    this.members.update((list) =>
      list.map((m) => {
        if (m.id === memberId) return { ...m, role: 'OWNER', roleLabel: /a$/i.test(m.roleLabel) ? 'Dueña' : 'Dueño' };
        if (m.role === 'OWNER') return { ...m, role: 'ADMIN', roleLabel: 'Administrador' };
        return m;
      }),
    );
  }

  // ---- Servicios ----

  addService(input: Omit<ClinicService, 'id'>): ClinicService {
    const service: ClinicService = { id: `s-${Date.now()}`, ...input };
    this.catalog.update((list) => [...list, service]);
    return service;
  }

  updateService(id: string, patch: Partial<ClinicService>): void {
    this.catalog.update((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  /** Un servicio con citas no se borra: devuelve false y el llamador lo desactiva. */
  removeService(id: string): boolean {
    const service = this.catalog().find((s) => s.id === id);
    if (!service) return true;
    if (this.appointments().some((a) => a.service === service.name)) return false;
    this.catalog.update((list) => list.filter((s) => s.id !== id));
    return true;
  }

  // ---- Horario y bloqueos ----

  setSchedule(days: ScheduleDay[]): void {
    this.schedule.set(days);
  }

  addBlock(input: Omit<ClinicBlock, 'id'>): void {
    this.blocks.update((list) => [...list, { id: `b-${Date.now()}`, ...input }].sort((a, b) => a.date - b.date));
  }

  removeBlock(id: string): void {
    this.blocks.update((list) => list.filter((b) => b.id !== id));
  }

  // ---- Mi clínica ----

  updateProfile(patch: Partial<ClinicProfile>): void {
    this.profile.update((p) => ({ ...p, ...patch }));
  }

  regenerateLinkCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `PATI-${part(4)}`;
    this.linkCode.set(code);
    return code;
  }

  revokeLinkCode(): void {
    this.linkCode.set(null);
  }
}
