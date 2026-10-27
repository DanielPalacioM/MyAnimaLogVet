import { computed, inject, Injectable } from '@angular/core';
import { ClinicBlock, ClinicService, ScheduleDay } from '../clinic/clinic.models';
import { ClinicStore } from '../clinic/clinic.store';
import { dayMonth, monthName, startOfDay } from '../clinic/date.utils';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Datos de la vista Servicios y horarios: catálogo, horario de atención y bloqueos. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly store = inject(ClinicStore);

  readonly services = this.store.catalog;
  readonly schedule = this.store.schedule;

  readonly summary = computed(() => {
    const all = this.services().length;
    const online = this.services().filter((s) => s.active && s.online).length;
    return `${all} ${all === 1 ? 'servicio' : 'servicios'} · ${online} se ${online === 1 ? 'reserva' : 'reservan'} en línea`;
  });

  /** Bloqueos que todavía no terminan, del más próximo al más lejano. */
  readonly upcomingBlocks = computed(() => {
    const today = startOfDay(this.store.now());
    return this.store
      .blocks()
      .filter((b) => (b.endDate ?? b.date) >= today)
      .sort((a, b) => a.date - b.date);
  });

  /** Personas que atienden (no cuenta recepción ni inactivos). */
  readonly professionalsCount = computed(() => this.store.members().filter((m) => m.active && m.role !== 'RECEPTION').length);

  /** Posición de hoy en el horario (0 = lunes). */
  readonly todayIndex = computed(() => (new Date(this.store.now()).getDay() + 6) % 7);

  dayName(day: number): string {
    return DAY_NAMES[day];
  }

  hours(d: ScheduleDay): string {
    return d.open && d.ranges.length ? d.ranges.map(([a, b]) => `${+a.slice(0, 2)}:${a.slice(3)} – ${+b.slice(0, 2)}:${b.slice(3)}`).join(' · ') : 'Cerrado';
  }

  duration(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  price(n: number): string {
    return `$${n.toLocaleString('es-CO')}`;
  }

  subLabel(s: ClinicService): string {
    return s.category === 'Cirugía' ? 'Cirugía · se agenda en la clínica' : s.category;
  }

  tileDay(b: ClinicBlock): string {
    return String(new Date(b.date).getDate());
  }

  tileMonth(b: ClinicBlock): string {
    return monthName(new Date(b.date).getMonth()).slice(0, 3).toUpperCase();
  }

  blockSub(b: ClinicBlock): string {
    const who = b.scope === 'CLINIC' ? 'Toda la clínica' : (this.store.members().find((m) => m.id === b.scope)?.name ?? this.store.professional(b.scope)?.name.replace(/^Dra?\.\s*/, '') ?? 'Profesional');
    if (b.endDate) return `${who} · hasta el ${dayMonth(b.endDate)}`;
    return b.allDay ? `${who} · todo el día` : `${who} · ${b.from} – ${b.to}`;
  }
}
