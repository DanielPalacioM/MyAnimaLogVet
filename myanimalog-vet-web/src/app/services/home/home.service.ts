import { computed, inject, Injectable } from '@angular/core';
import { SessionService } from '@auth/services/session.service';
import { ClinicStore } from '../clinic/clinic.store';
import { cap, longDate } from '../clinic/date.utils';

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
    if (n === 0) return 'Hoy no hay citas. Buen momento para dejar todo en orden.';
    if (n >= 15) return `Hoy tienes ${n} citas. Vamos paso a paso.`;
    return `Hoy tienes ${n} ${n === 1 ? 'cita' : 'citas'}. Vamos paso a paso.`;
  });

  readonly agenda = this.store.todayAppointments;
  readonly vaccinesToNotify = this.store.vaccinesToNotify;
  readonly invitations = this.store.invitations;

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

  readonly planLabel = 'Plan PRO';
  readonly renewsOn = computed(() => cap('3 nov'));
  readonly planProgress = 78;
  readonly storageUsedGb = 1.2;
  readonly storageTotalGb = 50;

  notifyVaccines(): void {
    for (const p of this.vaccinesToNotify()) this.store.notifyVaccine(p.id);
  }

  resend(id: string): void {
    this.store.resendInvitation(id);
  }
}
