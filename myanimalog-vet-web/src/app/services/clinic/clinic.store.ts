import { computed, inject, Injectable, signal } from '@angular/core';
import { SessionService } from '@auth/services/session.service';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { catchError, EMPTY, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../api-error';
import { ClinicProfileDto, SubscriptionDto } from '../api/api.models';
import { ClinicApi } from '../api/clinic.api';
import { hasProfessionalProfile, invitationFrom, memberFrom, profileFrom, roleFromApi, roleToApi } from '../api/mappers';
import { TeamApi } from '../api/team.api';
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
  Professional,
  ScheduleDay,
} from './clinic.models';
import { at, sameDay } from './date.utils';

const DAY = 86_400_000;
const COLORS = ['#F5A623', '#BDB8EE', '#9FE3D6', '#FFE2B8', '#FCE3E3', '#D9F5EF'];
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Datos de la clínica con la que se trabaja.
 *
 * **Conectado al backend:** perfil y configuración, logo, código de vinculación, plan, equipo e invitaciones.
 * **Sin backend todavía** (pacientes, citas, servicios, horario, bloqueos): quedan vacíos; no se inventan datos.
 * Cuando esos servicios existan, se cargan aquí mismo y las vistas no cambian.
 */
@Injectable({ providedIn: 'root' })
export class ClinicStore {
  private readonly clinicApi = inject(ClinicApi);
  private readonly teamApi = inject(TeamApi);
  private readonly session = inject(SessionService);
  private readonly context = inject(ClinicContextService);

  // ---- Del backend ----
  readonly profileDto = signal<ClinicProfileDto | null>(null);
  readonly profileState = signal<LoadState>('idle');
  readonly subscription = signal<SubscriptionDto | null>(null);
  readonly subscriptionState = signal<LoadState>('idle');
  readonly members = signal<Member[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly teamState = signal<LoadState>('idle');
  /** Código `VET-XXXXXXXX` para vincular dueños. Solo se conoce si el perfil lo trae o al generarlo. */
  readonly linkCode = signal<string | null>(null);

  // ---- Sin backend todavía ----
  readonly patients = signal<Patient[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  /** Pacientes a los que ya se les avisó por la vacuna vencida. */
  readonly notifiedVaccines = signal<ReadonlySet<string>>(new Set());
  readonly catalog = signal<ClinicService[]>([]);
  readonly schedule = signal<ScheduleDay[]>([]);
  readonly blocks = signal<ClinicBlock[]>([]);

  /** Reloj en ms (se actualiza cada minuto) para "próxima cita" y la línea de "ahora". */
  readonly now = signal(Date.now());

  readonly profile = computed<ClinicProfile | null>(() => {
    const dto = this.profileDto();
    return dto ? profileFrom(dto) : null;
  });

  /** Personas que atienden (no cuenta recepción ni inactivos): son las columnas de la agenda. */
  readonly professionalList = computed<Professional[]>(() =>
    this.members()
      .filter((m) => m.active && m.role !== 'RECEPTION')
      .map((m, i) => ({
        id: m.id,
        name: m.name,
        initials: initialsOf(m.name),
        role: m.roleLabel,
        color: COLORS[i % COLORS.length],
        verified: m.license === 'VERIFIED',
      })),
  );

  get professionals(): Professional[] {
    return this.professionalList();
  }

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

  /** Invitaciones que aún se pueden aceptar (vigentes). */
  readonly pendingInvitations = computed(() => this.invitations().filter((i) => !i.expired));

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
    const appointments = this.appointments();
    return [...byOwner.entries()].map(([owner, pets]): Client => {
      const last = pets.reduce((a, b) => (b.lastVisitAt > a.lastVisitAt ? b : a));
      const ids = new Set(pets.map((p) => p.id));
      const next =
        appointments
          .filter((a) => ids.has(a.patientId) && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && a.start + a.minutes * 60_000 >= now)
          .sort((a, b) => a.start - b.start)[0] ?? null;
      return {
        id: slug(owner),
        name: owner,
        initials: initialsOf(owner),
        email: '',
        phone: pets[0].phone,
        pets,
        linkedAt: 0,
        via: 'QR',
        lastVisit: last.lastVisit,
        lastVisitAt: last.lastVisitAt,
        next,
      };
    });
  });

  constructor() {
    setInterval(() => this.now.set(Date.now()), 60_000);
  }

  private get clinicId(): string | null {
    return this.session.clinic()?.veterinaryId ?? null;
  }

  patient(id: string): Patient | undefined {
    return this.patients().find((p) => p.id === id);
  }

  professional(id: string) {
    return this.professionalList().find((p) => p.id === id);
  }

  /** ¿La persona que tiene la sesión es la dueña? Solo ella transfiere la propiedad. */
  readonly iAmOwner = computed(() => this.members().some((m) => m.self && m.role === 'OWNER'));
  readonly myRole = computed<MemberRole | null>(() => this.members().find((m) => m.self)?.role ?? null);

  // ---------------------------------------------------------------- Carga

  /** Carga todo lo que tiene backend para la clínica actual. Los errores quedan en el estado de cada parte. */
  load(): void {
    const id = this.clinicId;
    if (!id) return;
    this.loadProfile().subscribe();
    this.loadSubscription().subscribe();
    this.loadTeam().subscribe();
  }

  /** Olvida todo (al cerrar sesión o cambiar de clínica). */
  reset(): void {
    this.profileDto.set(null);
    this.profileState.set('idle');
    this.subscription.set(null);
    this.subscriptionState.set('idle');
    this.members.set([]);
    this.invitations.set([]);
    this.teamState.set('idle');
    this.linkCode.set(null);
    this.patients.set([]);
    this.appointments.set([]);
    this.catalog.set([]);
    this.schedule.set([]);
    this.blocks.set([]);
  }

  loadProfile(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    this.profileState.set('loading');
    return this.clinicApi.profile(id).pipe(
      tap((dto) => {
        this.profileDto.set(dto);
        this.profileState.set('ready');
        if (dto.inviteCode) this.linkCode.set(dto.inviteCode);
        // Si el estado de la clínica cambió (aprobada, suspendida), la sesión se entera.
        this.session.patchClinic({ status: dto.status, veterinaryName: dto.name, city: dto.city });
      }),
      map(() => undefined),
      catchError(() => {
        this.profileState.set('error');
        return of(undefined);
      }),
    );
  }

  loadSubscription(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    this.subscriptionState.set('loading');
    return this.clinicApi.activeSubscription(id).pipe(
      tap((sub) => {
        this.subscription.set(sub);
        this.subscriptionState.set('ready');
      }),
      map(() => undefined),
      catchError((e: unknown) => {
        // Sin plan activo no es un error de la pantalla: simplemente no hay plan.
        this.subscription.set(null);
        this.subscriptionState.set(e instanceof ApiError && e.code === 'NO_ACTIVE_SUBSCRIPTION' ? 'ready' : 'error');
        return of(undefined);
      }),
    );
  }

  /** Equipo + invitaciones + tarjeta profesional de quienes la tienen. */
  loadTeam(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    this.teamState.set('loading');
    return this.teamApi.employees(id, true).pipe(
      switchMap((employees) => {
        const withProfile = employees.map((e) =>
          hasProfessionalProfile(roleFromApi(e.role)) && e.active
            ? this.teamApi.colleagueProfile(id, e.employeeId).pipe(catchError(() => of(null)))
            : of(null),
        );
        return (withProfile.length ? forkJoin(withProfile) : of([])).pipe(map((profiles) => ({ employees, profiles })));
      }),
      tap(({ employees, profiles }) => {
        this.members.set(employees.map((e, i) => memberFrom(e, profiles[i])));
        const me = employees.find((e) => e.self);
        if (me?.name) this.session.setFullName(me.name);
        if (me) this.session.patchClinic({ role: me.role });
      }),
      switchMap(() => this.loadInvitations()),
      tap(() => this.teamState.set('ready')),
      map(() => undefined),
      catchError(() => {
        this.teamState.set('error');
        return of(undefined);
      }),
    );
  }

  loadInvitations(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    const names = new Map(this.members().map((m) => [m.userId, m.name]));
    return this.teamApi.invitations(id, 'PENDING').pipe(
      tap((list) => this.invitations.set(list.map((i) => invitationFrom(i, names)))),
      map(() => undefined),
      // Si la clínica aún no está aprobada, listar puede fallar: se deja vacío.
      catchError(() => {
        this.invitations.set([]);
        return of(undefined);
      }),
    );
  }

  // ---------------------------------------------------------------- Equipo

  invite(email: string, role: Exclude<MemberRole, 'OWNER'>): Observable<void> {
    const id = this.clinicId!;
    return this.teamApi.invite(id, email.trim().toLowerCase(), roleToApi(role)).pipe(switchMap(() => this.loadInvitations()));
  }

  resendInvitation(invitationId: string): Observable<void> {
    return this.teamApi.resend(this.clinicId!, invitationId).pipe(switchMap(() => this.loadInvitations()));
  }

  cancelInvitation(invitationId: string): Observable<void> {
    return this.teamApi.revoke(this.clinicId!, invitationId).pipe(switchMap(() => this.loadInvitations()));
  }

  changeRole(memberId: string, role: Exclude<MemberRole, 'OWNER'>): Observable<void> {
    return this.teamApi.changeRole(this.clinicId!, memberId, roleToApi(role)).pipe(switchMap(() => this.loadTeam()));
  }

  /** Retira al empleado: queda inactivo y pierde el acceso en su siguiente petición. */
  removeMember(memberId: string): Observable<void> {
    return this.teamApi.removeEmployee(this.clinicId!, memberId).pipe(switchMap(() => this.loadTeam()));
  }

  /** La dueña pasa a administradora y el destino queda como dueño. Después hay que pedir un token de clínica nuevo. */
  transferOwnership(memberId: string): Observable<void> {
    const clinic = this.session.clinic();
    return this.teamApi.transferOwnership(this.clinicId!, memberId).pipe(
      switchMap(() => (clinic ? this.context.enter(clinic) : of(null))),
      switchMap(() => this.loadTeam()),
    );
  }

  leave(): Observable<void> {
    return this.teamApi.leave(this.clinicId!);
  }

  // ---------------------------------------------------------------- Mi clínica

  /** Guarda datos y configuración. Solo manda lo que cambió. */
  updateProfile(patch: Partial<ClinicProfile>): Observable<void> {
    const id = this.clinicId!;
    const data = pickDefined({ name: patch.name, city: patch.city, phone: patch.phone, email: patch.email });
    const settings = pickDefined({
      allowOnlineBooking: patch.onlineBooking,
      bookingRequiresConfirmation: patch.confirmEach,
      cancellationMinHours: patch.minCancelHours,
      defaultAppointmentMinutes: patch.defaultMinutes,
      directoryVisible: patch.inDirectory,
    });
    const calls: Observable<unknown>[] = [];
    if (Object.keys(data).length) calls.push(this.clinicApi.updateData(id, data));
    if (Object.keys(settings).length) calls.push(this.clinicApi.updateSettings(id, settings));
    return (calls.length ? forkJoin(calls) : of([])).pipe(switchMap(() => this.loadProfile()));
  }

  uploadLogo(file: File): Observable<void> {
    return this.clinicApi.uploadLogo(this.clinicId!, file).pipe(
      tap((res) => this.patchProfileDto({ logoUrl: res.logoUrl })),
      map(() => undefined),
    );
  }

  removeLogo(): Observable<void> {
    return this.clinicApi.deleteLogo(this.clinicId!).pipe(
      tap(() => this.patchProfileDto({ logoUrl: null })),
      map(() => undefined),
    );
  }

  /** Genera un código nuevo (el anterior deja de servir). */
  generateLinkCode(): Observable<string> {
    return this.clinicApi.generateInviteCode(this.clinicId!).pipe(
      tap((res) => this.linkCode.set(res.inviteCode)),
      map((res) => res.inviteCode ?? ''),
    );
  }

  revokeLinkCode(): Observable<void> {
    return this.clinicApi.deleteInviteCode(this.clinicId!).pipe(
      tap(() => this.linkCode.set(null)),
      map(() => undefined),
    );
  }

  private patchProfileDto(patch: Partial<ClinicProfileDto>): void {
    const dto = this.profileDto();
    if (dto) this.profileDto.set({ ...dto, ...patch });
  }

  // ---------------------------------------------------------------- Sin backend todavía
  // Estos métodos quedan para cuando existan los servicios de citas, pacientes y catálogo.
  // Mientras no, las vistas no los llaman (ver `FEATURES` en el entorno).

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
    const appointment: Appointment = { id: `a-${Date.now()}`, patientName: patient.name, status: 'CONFIRMED', source: 'CLINIC', ...input };
    this.appointments.update((list) => [...list, appointment]);
    return appointment;
  }

  setStatus(id: string, status: AppointmentStatus): void {
    this.appointments.update((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  /**
   * ¿La clínica atiende en ese horario? Devuelve el motivo si no: cerrado, fuera de horario o bloqueado.
   * Si todavía no hay horario configurado, no se restringe nada.
   */
  unavailableReason(start: number, minutes: number, professionalId?: string): string | null {
    const schedule = this.schedule();
    if (!schedule.length) return null;
    const d = new Date(start);
    const day = schedule.find((s) => s.day === (d.getDay() + 6) % 7);
    if (!day?.open) return 'Cerrado';
    const from = d.getHours() * 60 + d.getMinutes();
    const to = from + minutes;
    if (!day.ranges.some(([a, b]) => from >= toMin(a) && to <= toMin(b))) return 'Fuera de horario';
    const end = start + minutes * 60_000;
    const blocked = this.blocks().some((b) => {
      if (b.scope !== 'CLINIC' && b.scope !== professionalId) return false;
      const first = b.date;
      const lastDay = b.endDate ?? b.date;
      const blockFrom = b.allDay ? first : at(first, b.from ?? '00:00');
      const until = b.allDay ? lastDay + DAY : at(first, b.to ?? '23:59');
      return blockFrom < end && start < until;
    });
    return blocked ? 'Bloqueado' : null;
  }

  addPatient(input: NewPatient): Patient {
    const patient: Patient = { id: `p-${Date.now()}`, ...input, lastVisit: 'Sin visitas', lastVisitService: '—', lastVisitAt: 0, vaccines: 'NONE', inApp: false };
    this.patients.update((list) => [patient, ...list]);
    return patient;
  }

  /** Quita al cliente: la clínica pierde el acceso a todas sus mascotas. */
  removeClient(owner: string): void {
    this.patients.update((list) => list.map((p) => (p.owner === owner ? { ...p, inApp: false } : p)));
  }

  notifyVaccine(patientId: string): void {
    this.notifiedVaccines.update((s) => new Set(s).add(patientId));
  }

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

  setSchedule(days: ScheduleDay[]): void {
    this.schedule.set(days);
  }

  addBlock(input: Omit<ClinicBlock, 'id'>): void {
    this.blocks.update((list) => [...list, { id: `b-${Date.now()}`, ...input }].sort((a, b) => a.date - b.date));
  }

  removeBlock(id: string): void {
    this.blocks.update((list) => list.filter((b) => b.id !== id));
  }

  setMemberSchedule(memberId: string, schedule: string): void {
    this.members.update((list) => list.map((m) => (m.id === memberId ? { ...m, schedule } : m)));
  }
}

function pickDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

