import { computed, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Patient, Species } from '../clinic/clinic.models';
import { ClinicStore } from '../clinic/clinic.store';
import { sameDay } from '../clinic/date.utils';

export type SpeciesTab = 'ALL' | Species;
export type PatientSort = 'lastVisit' | 'name' | 'nextAppointment';
export const PAGE_SIZE = 9;

export interface PatientRow {
  patient: Patient;
  /** Próxima cita futura (ms) o null. */
  next: { start: number; professionalName: string } | null;
  hasAppointmentToday: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Estado y datos de la vista Pacientes: búsqueda, filtros, orden y paginación. */
@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly store = inject(ClinicStore);

  readonly query = signal('');
  readonly tab = signal<SpeciesTab>('ALL');
  readonly onlyOverdue = signal(false);
  readonly onlyUnclaimed = signal(false);
  readonly onlyToday = signal(false);
  readonly sort = signal<PatientSort>('lastVisit');
  readonly page = signal(1);
  readonly selectedId = signal<string | null>(null);

  readonly total = computed(() => this.store.patients().length);
  readonly selected = computed(() => this.store.patient(this.selectedId() ?? '') ?? null);

  private readonly rows = computed<PatientRow[]>(() => {
    const now = this.store.now();
    const upcoming = new Map<string, PatientRow['next']>();
    const today = new Set<string>();
    for (const a of [...this.store.appointments()].sort((x, y) => x.start - y.start)) {
      if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') continue;
      if (sameDay(a.start, now)) today.add(a.patientId);
      if (a.start + a.minutes * 60_000 >= now && !upcoming.has(a.patientId)) {
        upcoming.set(a.patientId, { start: a.start, professionalName: this.store.professional(a.professionalId)?.name ?? '' });
      }
    }
    return this.store.patients().map((patient) => ({
      patient,
      next: upcoming.get(patient.id) ?? null,
      hasAppointmentToday: today.has(patient.id),
    }));
  });

  readonly counts = computed(() => {
    const r = this.rows();
    return {
      all: r.length,
      dogs: r.filter((x) => x.patient.species === 'Perro').length,
      cats: r.filter((x) => x.patient.species === 'Gato').length,
      others: r.filter((x) => x.patient.species === 'Otro').length,
      overdue: r.filter((x) => x.patient.vaccines === 'OVERDUE').length,
      unclaimed: r.filter((x) => !x.patient.inApp).length,
      today: r.filter((x) => x.hasAppointmentToday).length,
    };
  });

  readonly filtered = computed(() => {
    const q = norm(this.query().trim());
    const tab = this.tab();
    let list = this.rows().filter((r) => {
      const p = r.patient;
      if (tab !== 'ALL' && p.species !== tab) return false;
      if (this.onlyOverdue() && p.vaccines !== 'OVERDUE') return false;
      if (this.onlyUnclaimed() && p.inApp) return false;
      if (this.onlyToday() && !r.hasAppointmentToday) return false;
      return !q || norm(`${p.name} ${p.owner} ${p.phone}`).includes(q) || p.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''));
    });
    const sort = this.sort();
    list = [...list].sort((a, b) =>
      sort === 'name'
        ? a.patient.name.localeCompare(b.patient.name, 'es')
        : sort === 'nextAppointment'
          ? (a.next?.start ?? Infinity) - (b.next?.start ?? Infinity)
          : b.patient.lastVisitAt - a.patient.lastVisitAt,
    );
    return list;
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly current = computed(() => Math.min(this.page(), this.pageCount()));
  readonly pageRows = computed(() => this.filtered().slice((this.current() - 1) * PAGE_SIZE, this.current() * PAGE_SIZE));
  readonly rangeLabel = computed(() => {
    const total = this.filtered().length;
    if (!total) return 'Sin resultados';
    const from = (this.current() - 1) * PAGE_SIZE + 1;
    return `Mostrando ${from}–${Math.min(total, from + PAGE_SIZE - 1)} de ${total} pacientes`;
  });

  /** Botones de página: 1 2 3 … N. */
  readonly pages = computed<(number | '…')[]>(() => {
    const n = this.pageCount();
    const c = this.current();
    if (n <= 5) return Array.from({ length: n }, (_, i) => i + 1);
    if (c <= 3) return [1, 2, 3, '…', n];
    if (c >= n - 2) return [1, '…', n - 2, n - 1, n];
    return [1, '…', c, '…', n];
  });

  setFilter<T>(sig: WritableSignal<T>, value: T): void {
    sig.set(value);
    this.page.set(1);
  }

  toggle(sig: WritableSignal<boolean>): void {
    sig.set(!sig());
    this.page.set(1);
  }

  resetFilters(): void {
    this.query.set('');
    this.tab.set('ALL');
    this.onlyOverdue.set(false);
    this.onlyUnclaimed.set(false);
    this.onlyToday.set(false);
    this.page.set(1);
  }

  nextAppointmentsOf(patientId: string) {
    const now = this.store.now();
    return this.store
      .appointments()
      .filter((a) => a.patientId === patientId && a.status !== 'CANCELLED' && a.start + a.minutes * 60_000 >= now)
      .sort((a, b) => a.start - b.start);
  }
}
