import { computed, inject, Injectable, signal } from '@angular/core';
import { SessionService } from '@auth/services/session.service';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { catchError, EMPTY, expand, forkJoin, from, map, mergeMap, Observable, of, reduce, switchMap, tap, throwError } from 'rxjs';
import { ApiError } from '../api-error';
import { ClinicProfileDto, SubscriptionDto } from '../api/api.models';
import { AppointmentAction, AppointmentDto, CalendarApi } from '../api/calendar.api';
import { CatalogApi, ServiceBody } from '../api/catalog.api';
import { ClinicApi } from '../api/clinic.api';
import { ScheduleApi } from '../api/schedule.api';
import { ClientDto, LinkApi, PageDto, PatientDto } from '../api/link.api';
import {
  appointmentFrom,
  blockFrom,
  blockToApi,
  categoryToApi,
  clientFrom,
  hasProfessionalProfile,
  invitationFrom,
  memberFrom,
  patientFrom,
  profileFrom,
  roleFromApi,
  roleToApi,
  scheduleFrom,
  scheduleToApi,
  serviceFrom,
  withDetail,
} from '../api/mappers';
import { TeamApi } from '../api/team.api';
import {
  Appointment,
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
import { FEATURE_MESSAGE, FEATURES } from '../features';
import { addDays, at, sameDay, startOfDay } from './date.utils';

const DAY = 86_400_000;
/** Al entrar a la clínica se piden las citas de hoy y de los próximos días (solicitudes, "próxima cita" de clientes). */
const UPCOMING_DAYS = 30;
/** Tamaño de página al pedir clientes y pacientes (se piden todas las páginas). */
const PEOPLE_PAGE = 100;
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
 * **Conectado al backend:** perfil y configuración, logo, código de vinculación, plan, equipo e invitaciones,
 * clientes y pacientes (mascotas compartidas), catálogo de servicios y citas (calendar-service).
 * horario de atención y bloqueos. **Sin backend todavía:** horarios por profesional y registrar pacientes sin app.
 */
@Injectable({ providedIn: 'root' })
export class ClinicStore {
  private readonly clinicApi = inject(ClinicApi);
  private readonly teamApi = inject(TeamApi);
  private readonly linkApi = inject(LinkApi);
  private readonly calendarApi = inject(CalendarApi);
  private readonly catalogApi = inject(CatalogApi);
  private readonly scheduleApi = inject(ScheduleApi);
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

  readonly patients = signal<Patient[]>([]);
  /** Citas tal como llegan del calendar-service. */
  private readonly appointmentDtos = signal<AppointmentDto[]>([]);
  readonly appointmentsState = signal<LoadState>('idle');
  /** Citas del panel: se arman con los pacientes y el catálogo, así se completan solas cuando estos terminan de cargar. */
  readonly appointments = computed<Appointment[]>(() => {
    const patients = this.patients();
    const catalog = this.catalog();
    return this.appointmentDtos().map((dto) => appointmentFrom(dto, patients, catalog));
  });
  readonly catalog = signal<ClinicService[]>([]);
  readonly catalogState = signal<LoadState>('idle');

  // ---- Sin backend todavía ----
  /** Pacientes a los que ya se les avisó por la vacuna vencida. */
  readonly notifiedVaccines = signal<ReadonlySet<string>>(new Set());
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

  /** Dueños vinculados a la clínica (`GET /{id}/clients`), tengan o no mascotas compartidas. */
  readonly clientList = signal<ClientDto[]>([]);
  /** Estado de la carga de clientes y pacientes (van juntos: los pacientes se asignan a su dueño). */
  readonly peopleState = signal<LoadState>('idle');

  /** Cada cliente con las mascotas que compartió. La próxima cita sale de la agenda cuando exista. */
  readonly clients = computed<Client[]>(() => {
    const pets = this.patients();
    const now = this.now();
    const appointments = this.appointments();
    return this.clientList().map((dto): Client => {
      const mine = pets.filter((p) => p.ownerId === dto.userId);
      const last = mine.reduce<Patient | null>((a, b) => (!a || b.lastVisitAt > a.lastVisitAt ? b : a), null);
      const ids = new Set(mine.map((p) => p.id));
      const next =
        appointments
          .filter((a) => ids.has(a.patientId) && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && a.start + a.minutes * 60_000 >= now)
          .sort((a, b) => a.start - b.start)[0] ?? null;
      return { ...clientFrom(dto, mine), lastVisit: last?.lastVisit ?? 'Sin visitas', lastVisitAt: last?.lastVisitAt ?? 0, next };
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
    this.loadLinkCode().subscribe();
    this.loadPeople().subscribe();
    // Catálogo: se leen los servicios reservables de Calendar (el CRUD, VET-31, aún no existe).
    this.loadCatalog().subscribe();
    // Horario y bloqueos (VET-32) aún no existen en el backend: con la función apagada no se hace la llamada.
    if (FEATURES.schedule) this.loadSchedule().subscribe();
    const today = startOfDay(Date.now());
    this.loadAppointments(today, addDays(today, UPCOMING_DAYS)).subscribe();
  }

  /** Catálogo de servicios (`GET /{id}/services`). Es lo que se puede agendar. */
  loadCatalog(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    this.catalogState.set('loading');
    return (FEATURES.catalog ? this.catalogApi.list(id) : this.catalogApi.bookable(id)).pipe(
      tap((list) => {
        this.catalog.set(list.map(serviceFrom));
        this.catalogState.set('ready');
      }),
      map(() => undefined),
      catchError(() => {
        this.catalogState.set('error');
        return of(undefined);
      }),
    );
  }

  /**
   * Citas de `[from, to)`: reemplaza las que ya había en ese rango y deja las demás. Así la agenda puede pedir
   * el mes que mira sin borrar lo que cargó Inicio.
   */
  /** El backend rechaza rangos de más de 31 días (400 VALIDATION_ERROR): se pide por tramos de 30 y se juntan. */
  private listRange(id: string, from: number, to: number): Observable<AppointmentDto[]> {
    const chunks: [number, number][] = [];
    for (let a = from; a < to; ) {
      const b = Math.min(addDays(a, 30), to);
      chunks.push([a, b]);
      a = b;
    }
    if (chunks.length <= 1) return this.calendarApi.list(id, from, to);
    return forkJoin(chunks.map(([a, b]) => this.calendarApi.list(id, a, b))).pipe(map((parts) => parts.flat()));
  }

  loadAppointments(from: number, to: number): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    this.appointmentsState.set('loading');
    return this.listRange(id, from, to).pipe(
      tap((list) => {
        if (this.clinicId !== id) return; // cambió de clínica mientras tanto
        const inRange = (dto: AppointmentDto) => {
          const t = new Date(dto.startsAt).getTime();
          return t >= from && t < to;
        };
        this.appointmentDtos.update((all) => [...all.filter((dto) => !inRange(dto)), ...list]);
        this.appointmentsState.set('ready');
      }),
      map(() => undefined),
      catchError(() => {
        this.appointmentsState.set('error');
        return of(undefined);
      }),
    );
  }

  /**
   * Clientes (dueños vinculados) y pacientes (mascotas compartidas), del backend. Se piden juntos y se cruzan por
   * `userId`. El servicio puede responder `403/409` si la clínica aún no está aprobada: queda en estado `error`.
   */
  loadPeople(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    this.peopleState.set('loading');
    return forkJoin({
      clients: this.fetchAll((page) => this.linkApi.clients(id, page, PEOPLE_PAGE)),
      patients: this.fetchAll((page) => this.linkApi.patients(id, page, PEOPLE_PAGE)),
    }).pipe(
      tap(({ clients, patients }) => {
        const owners = new Map(clients.map((c) => [c.userId, c.name?.trim() || c.email || 'Sin nombre']));
        this.clientList.set(clients);
        // Lo que ya se trajo del detalle (edad, sexo) se conserva al recargar, para que la lista no parpadee.
        const before = new Map(this.patients().map((p) => [p.id, p]));
        this.patients.set(
          patients.map((dto) => {
            const base = patientFrom(dto, owners.get(dto.ownerUserId) ?? 'Sin nombre');
            const old = before.get(dto.petId);
            return old?.birthDate ? { ...base, age: old.age, sex: old.sex, birthDate: old.birthDate } : base;
          }),
        );
        this.peopleState.set('ready');
        this.enrichPatients(id, patients);
      }),
      map(() => undefined),
      catchError(() => {
        this.peopleState.set('error');
        return of(undefined);
      }),
    );
  }

  /**
   * La lista de pacientes solo trae nombre, especie, raza y foto. Sexo y fecha de nacimiento (la edad) están en el
   * detalle, así que se piden en segundo plano (de a 5) y la fila se completa sola. Si uno falla, queda con lo básico.
   */
  private enrichPatients(veterinaryId: string, list: PatientDto[]): void {
    from(list)
      .pipe(mergeMap((p) => this.linkApi.patient(veterinaryId, p.petId).pipe(catchError(() => EMPTY)), 5))
      .subscribe((detail) => {
        if (this.clinicId !== veterinaryId) return; // cambió de clínica mientras tanto
        this.patients.update((all) => all.map((p) => (p.id === detail.petId ? withDetail(p, detail, this.now()) : p)));
      });
  }

  /** Junta todas las páginas de un listado paginado del backend. */
  private fetchAll<T>(fetch: (page: number) => Observable<PageDto<T>>): Observable<T[]> {
    return fetch(0).pipe(
      expand((res) => (res.items.length > 0 && (res.page + 1) * res.size < res.total ? fetch(res.page + 1) : EMPTY)),
      reduce((all, res) => all.concat(res.items), [] as T[]),
    );
  }

  /** Código de vinculación vigente (el perfil no siempre lo trae). */
  loadLinkCode(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.linkApi.linkCode(id).pipe(
      tap((res) => {
        if (res.inviteCode) this.linkCode.set(res.inviteCode);
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
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
    this.clientList.set([]);
    this.peopleState.set('idle');
    this.patients.set([]);
    this.appointmentDtos.set([]);
    this.appointmentsState.set('idle');
    this.catalogState.set('idle');
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

  /** La clínica agenda (nace confirmada). El servidor valida horario, empleado elegible y franja libre. */
  addAppointment(input: NewAppointment): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.calendarApi
      .create(id, {
        serviceId: input.serviceId,
        petId: input.patientId,
        employeeId: input.professionalId,
        startsAt: new Date(input.start).toISOString(),
        ...(input.note ? { notes: input.note } : {}),
      })
      .pipe(
        tap((dto) => this.upsertAppointment(dto)),
        map(() => undefined),
      );
  }

  /** Confirmar, rechazar, marcar llegada, atendida, no asistió o cancelar. La respuesta trae la cita ya actualizada. */
  act(appointmentId: string, action: AppointmentAction, reason?: string): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.calendarApi.act(id, appointmentId, action, reason).pipe(
      tap((dto) => this.upsertAppointment(dto, appointmentId)),
      map(() => undefined),
    );
  }

  /** Reprograma a otra hora (el servidor revalida la disponibilidad: `409 SLOT_UNAVAILABLE` si está ocupada). */
  reschedule(appointmentId: string, start: number): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.calendarApi.reschedule(id, appointmentId, new Date(start).toISOString()).pipe(
      tap((dto) => this.upsertAppointment(dto, appointmentId)),
      map(() => undefined),
    );
  }

  /** Mezcla la respuesta del servidor con lo que ya había de la cita (la respuesta puede traer solo algunos campos). */
  private upsertAppointment(dto: AppointmentDto, knownId?: string): void {
    const id = dto.id ?? knownId;
    if (!id) return;
    this.appointmentDtos.update((all) => {
      const old = all.find((a) => a.id === id);
      const merged = { ...old, ...dto, id } as AppointmentDto;
      return old ? all.map((a) => (a.id === id ? merged : a)) : [...all, merged];
    });
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

  /**
   * Quita al cliente: el backend revoca todas sus mascotas y borra su correo y teléfono del lado de la clínica
   * (conserva el nombre). Después se recargan clientes y pacientes. Devuelve cuántas mascotas se revocaron.
   */
  removeClient(userId: string): Observable<number> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.linkApi.removeClient(id, userId).pipe(
      switchMap((res) => this.loadPeople().pipe(map(() => res.revokedPetsCount))),
    );
  }

  notifyVaccine(patientId: string): void {
    this.notifiedVaccines.update((s) => new Set(s).add(patientId));
  }

  // ---------------------------------------------------------------- Catálogo

  addService(input: Omit<ClinicService, 'id' | 'active'>): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    if (!FEATURES.catalog) return throwError(() => new ApiError('NOT_AVAILABLE', FEATURE_MESSAGE.catalog));
    return this.catalogApi.create(id, serviceBody(input)).pipe(switchMap(() => this.loadCatalog()));
  }

  /** Solo manda lo que cambió y recarga el catálogo. Activar o desactivar usa `active`. */
  updateService(serviceId: string, patch: Partial<ClinicService>): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    if (!FEATURES.catalog) return throwError(() => new ApiError('NOT_AVAILABLE', FEATURE_MESSAGE.catalog));
    const current = this.catalog().find((s) => s.id === serviceId);
    if (patch.active === false) {
      return this.catalogApi.deactivate(id, serviceId).pipe(switchMap(() => this.loadCatalog()));
    }
    const body: Partial<ServiceBody> & { active?: boolean } = current ? serviceBody({ ...current, ...patch }) : {};
    if (patch.active) body.active = true;
    return this.catalogApi.update(id, serviceId, body).pipe(switchMap(() => this.loadCatalog()));
  }

  /** Un servicio no se borra (hay citas que lo referencian): se desactiva. */
  deactivateService(serviceId: string): Observable<void> {
    return this.updateService(serviceId, { active: false });
  }

  // ---------------------------------------------------------------- Horario y bloqueos

  /** Horario de atención y bloqueos de los próximos 12 meses. Si falla, quedan como estaban. */
  loadSchedule(): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    const from = startOfDay(Date.now());
    return forkJoin({
      hours: this.scheduleApi.businessHours(id),
      blocks: this.scheduleApi.blocks(id, from, addDays(from, 365)),
    }).pipe(
      tap(({ hours, blocks }) => {
        if (this.clinicId !== id) return;
        // Sin tramos guardados no hay horario configurado: la lista queda vacía y no restringe nada.
        this.schedule.set(hours.length ? scheduleFrom(hours) : []);
        this.blocks.set(blocks.map(blockFrom).sort((a, b) => a.date - b.date));
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /** Guarda la semana completa y la vuelve a leer. */
  saveSchedule(days: ScheduleDay[]): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.scheduleApi.replaceBusinessHours(id, scheduleToApi(days)).pipe(switchMap(() => this.loadSchedule()));
  }

  addBlock(input: Omit<ClinicBlock, 'id'>): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.scheduleApi.createBlock(id, blockToApi(input)).pipe(switchMap(() => this.loadSchedule()));
  }

  removeBlock(blockId: string): Observable<void> {
    const id = this.clinicId;
    if (!id) return EMPTY;
    return this.scheduleApi.deleteBlock(id, blockId).pipe(switchMap(() => this.loadSchedule()));
  }

  setMemberSchedule(memberId: string, schedule: string): void {
    this.members.update((list) => list.map((m) => (m.id === memberId ? { ...m, schedule } : m)));
  }
}

function serviceBody(s: Pick<ClinicService, 'name' | 'category' | 'minutes' | 'price' | 'online' | 'professionalIds'>): ServiceBody {
  return {
    name: s.name.trim(),
    category: categoryToApi(s.category),
    durationMinutes: s.minutes,
    price: s.price,
    bookableOnline: s.online,
    employeeIds: s.professionalIds,
  };
}

function pickDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

