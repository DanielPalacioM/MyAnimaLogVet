import { computed, inject, Injectable } from '@angular/core';
import { SessionService } from '@auth/services/session.service';
import { ClinicStore } from '../clinic/clinic.store';
import { FEATURES } from '../features';
import { cap, dayMonth, longDate, timeAgo } from '../clinic/date.utils';

const PLAN_NAME: Record<string, string> = { PRO_TRIAL: 'PRO (prueba)', PRO: 'PRO', BASIC: 'Básico', FREE: 'Gratis' };

/** Datos de la vista Inicio (saludo, agenda de hoy, pendientes y resumen de la clínica). */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly store = inject(ClinicStore);
  private readonly session = inject(SessionService);

  readonly clinicName = computed(() => this.session.clinic()?.veterinaryName ?? 'tu clínica');
  /** "Clínica Patitas" → "Patitas". */
  readonly teamName = computed(() => this.clinicName().replace(/^cl[ií]nica\s+/i, ''));

  readonly dateLabel = computed(() => longDate(this.store.now()).toUpperCase());
  readonly greeting = computed(() => {
    const h = new Date(this.store.now()).getHours();
    const salute = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `¡${salute}, equipo ${this.teamName()}!`;
  });

  readonly activeToday = this.store.todayActiveCount;
  readonly requests = this.store.pendingRequests;
  readonly overdueCount = computed(() => this.store.overdueVaccines().length);

  /** Frase del saludo según el día (DISENO §8). */
  readonly phrase = computed(() => {
    const n = this.activeToday();
    if (!FEATURES.appointments) return 'Mientras se conecta la agenda, deja lista tu clínica y arma tu equipo.';
    if (n === 0) return 'Hoy no hay citas. Buen momento para dejar todo en orden.';
    if (n >= 15) return `Hoy tienes ${n} citas. Vamos paso a paso.`;
    return `Hoy tienes ${n} ${n === 1 ? 'cita' : 'citas'}. Vamos paso a paso.`;
  });

  readonly agenda = this.store.todayAppointments;
  readonly vaccinesToNotify = this.store.vaccinesToNotify;
  /** Invitaciones al equipo que aún no se aceptan ("Sofía no ha aceptado…"). */
  readonly invitations = computed(() =>
    this.store.pendingInvitations().map((i) => ({
      id: i.id,
      name: cap(i.email.split('@')[0].split(/[._]/)[0]),
      sentAgo: timeAgo(i.sentAt, this.store.now()),
    })),
  );

  /** Cuántas cosas hay por resolver (el número junto al título). */
  readonly pendingTotal = computed(
    () => (this.requests().length ? 1 : 0) + (this.vaccinesToNotify().length ? 1 : 0) + this.invitations().length,
  );

  readonly nextId = computed(() => {
    const now = this.store.now();
    return this.agenda().find((a) => (a.status === 'CONFIRMED' || a.status === 'REQUESTED') && a.start + a.minutes * 60_000 > now)?.id ?? null;
  });

  /** Minutos que faltan para la próxima cita ("En 25 min"). */
  minutesUntil(start: number): number {
    return Math.max(0, Math.round((start - this.store.now()) / 60_000));
  }

  /** Plan de la clínica (`GET /subscription/active`). */
  readonly subscription = this.store.subscription;
  readonly planLabel = computed(() => {
    const sub = this.subscription();
    return sub ? `Plan ${PLAN_NAME[sub.plan] ?? sub.plan}` : 'Sin plan activo';
  });
  /** "Renueva el 3 nov" / "Vence el 29 nov" (la prueba no se renueva). */
  readonly renewsOn = computed(() => {
    const sub = this.subscription();
    if (!sub) return '';
    const end = dayMonth(new Date(`${sub.endDate}T00:00:00`).getTime());
    return sub.plan.endsWith('TRIAL') ? `Vence el ${end}` : `Renueva el ${end}`;
  });
  /** Cuánto del plan ya pasó, de 0 a 100. */
  readonly planProgress = computed(() => {
    const sub = this.subscription();
    if (!sub) return 0;
    const start = new Date(`${sub.startDate}T00:00:00`).getTime();
    const end = new Date(`${sub.endDate}T00:00:00`).getTime();
    return end > start ? Math.min(100, Math.max(0, Math.round(((this.store.now() - start) / (end - start)) * 100))) : 0;
  });

  notifyVaccines(): void {
    for (const p of this.vaccinesToNotify()) this.store.notifyVaccine(p.id);
  }

  resend(id: string) {
    return this.store.resendInvitation(id);
  }
}
