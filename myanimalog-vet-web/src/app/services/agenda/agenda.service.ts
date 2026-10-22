import { computed, inject, Injectable, signal } from '@angular/core';
import { Appointment, isActive } from '../clinic/clinic.models';
import { ClinicStore } from '../clinic/clinic.store';
import { addDays, sameDay, startOfDay, startOfWeek } from '../clinic/date.utils';

export type AgendaView = 'day' | 'week';

/** Horario visible de la agenda (Figma 1941:174): 8:00 a. m. a 5:00 p. m., 72 px por hora. */
export const AGENDA_START_HOUR = 8;
export const AGENDA_END_HOUR = 17;
export const HOUR_PX = 72;
/** Almuerzo de todo el equipo (hora bloqueada). */
export const LUNCH = { from: 12, to: 13 };

/** Estado y datos de la vista Agenda. */
@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly store = inject(ClinicStore);

  readonly day = signal(startOfDay(Date.now()));
  readonly view = signal<AgendaView>('day');
  /** Mes que muestra el mini calendario. */
  readonly month = signal(startOfDay(Date.now()));
  readonly selectedId = signal<string | null>(null);

  readonly professionals = this.store.professionals;
  readonly requests = this.store.pendingRequests;

  readonly isToday = computed(() => sameDay(this.day(), this.store.now()));
  readonly weekDays = computed(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(this.day()), i)));

  /** Citas del día elegido (sin canceladas). */
  readonly dayAppointments = computed(() =>
    this.store
      .appointments()
      .filter((a) => sameDay(a.start, this.day()) && a.status !== 'CANCELLED')
      .sort((a, b) => a.start - b.start),
  );

  readonly selected = computed<Appointment | null>(
    () => this.store.appointments().find((a) => a.id === this.selectedId()) ?? null,
  );

  /** Días del mes con citas (puntos del calendario). */
  readonly daysWithAppointments = computed(() => {
    const set = new Set<number>();
    for (const a of this.store.appointments()) if (a.status !== 'CANCELLED') set.add(startOfDay(a.start));
    return set;
  });

  /** Próxima cita de hoy (sin atender): lleva el borde morado y la etiqueta "Próxima". */
  readonly nextId = computed(() => {
    const now = this.store.now();
    return (
      this.store
        .todayAppointments()
        .find((a) => (a.status === 'CONFIRMED' || a.status === 'REQUESTED') && a.start + a.minutes * 60_000 > now)?.id ?? null
    );
  });

  forProfessional(professionalId: string): Appointment[] {
    return this.dayAppointments().filter((a) => a.professionalId === professionalId);
  }

  appointmentsOn(day: number): Appointment[] {
    return this.store
      .appointments()
      .filter((a) => sameDay(a.start, day) && a.status !== 'CANCELLED')
      .sort((a, b) => a.start - b.start);
  }

  activeCountFor(professionalId: string): number {
    return this.forProfessional(professionalId).filter(isActive).length;
  }

  // ---- Navegación ----

  goTo(day: number): void {
    this.day.set(startOfDay(day));
    this.month.set(startOfDay(day));
  }

  today(): void {
    this.goTo(Date.now());
  }

  step(direction: 1 | -1): void {
    this.goTo(addDays(this.day(), direction * (this.view() === 'week' ? 7 : 1)));
  }

  stepMonth(direction: 1 | -1): void {
    const d = new Date(this.month());
    d.setMonth(d.getMonth() + direction, 1);
    this.month.set(d.getTime());
  }

  // ---- Acciones sobre citas ----

  setStatus = (id: string, status: Appointment['status']) => this.store.setStatus(id, status);
}
