import { computed, inject, Injectable, signal } from '@angular/core';
import { Client } from '../clinic/clinic.models';
import { ClinicStore } from '../clinic/clinic.store';
import { dayMonth, sameDay, timeLabel } from '../clinic/date.utils';

export type ClientFilter = 'ALL' | 'NEXT' | 'MONTH';
export type ClientSort = 'name' | 'lastVisit' | 'next' | 'linked';
export const CLIENTS_PAGE_SIZE = 9;

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Estado y datos de la vista Clientes: búsqueda, filtros, orden y paginación. */
@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly store = inject(ClinicStore);

  readonly query = signal('');
  readonly filter = signal<ClientFilter>('ALL');
  readonly sort = signal<ClientSort>('name');
  readonly page = signal(1);
  readonly selectedId = signal<string | null>(null);

  readonly all = this.store.clients;
  readonly selected = computed<Client | null>(() => this.all().find((c) => c.id === this.selectedId()) ?? null);

  private isThisMonth(c: Client): boolean {
    const now = new Date(this.store.now());
    const d = new Date(c.linkedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  readonly counts = computed(() => ({
    all: this.all().length,
    next: this.all().filter((c) => c.next).length,
    month: this.all().filter((c) => this.isThisMonth(c)).length,
  }));

  readonly filtered = computed(() => {
    const q = norm(this.query().trim());
    const filter = this.filter();
    let list = this.all().filter((c) => {
      if (filter === 'NEXT' && !c.next) return false;
      if (filter === 'MONTH' && !this.isThisMonth(c)) return false;
      if (!q) return true;
      return norm(`${c.name} ${c.email}`).includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''));
    });
    const sort = this.sort();
    list = [...list].sort((a, b) =>
      sort === 'lastVisit'
        ? b.lastVisitAt - a.lastVisitAt
        : sort === 'next'
          ? (a.next?.start ?? Infinity) - (b.next?.start ?? Infinity)
          : sort === 'linked'
            ? b.linkedAt - a.linkedAt
            : a.name.localeCompare(b.name, 'es'),
    );
    return list;
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / CLIENTS_PAGE_SIZE)));
  readonly current = computed(() => Math.min(this.page(), this.pageCount()));
  readonly pageRows = computed(() => this.filtered().slice((this.current() - 1) * CLIENTS_PAGE_SIZE, this.current() * CLIENTS_PAGE_SIZE));
  readonly rangeLabel = computed(() => {
    const total = this.filtered().length;
    if (!total) return 'Sin resultados';
    const from = (this.current() - 1) * CLIENTS_PAGE_SIZE + 1;
    return `Mostrando ${from}–${Math.min(total, from + CLIENTS_PAGE_SIZE - 1)} de ${total} clientes`;
  });

  setFilter(f: ClientFilter): void {
    this.filter.set(f);
    this.page.set(1);
  }

  setSort(s: ClientSort): void {
    this.sort.set(s);
    this.page.set(1);
  }

  reset(): void {
    this.query.set('');
    this.filter.set('ALL');
    this.page.set(1);
  }

  /** Citas del cliente: la próxima y la más reciente (como la ficha del diseño). */
  history(c: Client): { date: string; time: string; title: string; by: string; upcoming: boolean }[] {
    const ids = new Set(c.pets.map((p) => p.id));
    const now = this.store.now();
    const label = (ms: number) => (sameDay(ms, now) ? 'Hoy' : dayMonth(ms));
    const mine = this.store
      .appointments()
      .filter((a) => ids.has(a.patientId) && a.status !== 'CANCELLED')
      .map((a) => ({ a, upcoming: a.start + a.minutes * 60_000 >= now }));
    const next = mine.filter((x) => x.upcoming).sort((x, y) => x.a.start - y.a.start)[0];
    const past = mine.filter((x) => !x.upcoming).sort((x, y) => y.a.start - x.a.start)[0];
    const pro = (id: string) => this.store.professional(id)?.name ?? '';
    const out: { date: string; time: string; title: string; by: string; upcoming: boolean }[] = [];
    if (next) out.push({ date: label(next.a.start), time: timeLabel(next.a.start), title: `${next.a.patientName} · ${next.a.service}`, by: pro(next.a.professionalId), upcoming: true });
    if (past) out.push({ date: label(past.a.start), time: 'Atendida', title: `${past.a.patientName} · ${past.a.service}`, by: pro(past.a.professionalId), upcoming: false });
    else {
      const pet = [...c.pets].filter((p) => p.lastVisitAt > 0).sort((x, y) => y.lastVisitAt - x.lastVisitAt)[0];
      if (pet) out.push({ date: pet.lastVisit, time: 'Atendida', title: `${pet.name} · ${pet.lastVisitService}`, by: '', upcoming: false });
    }
    return out;
  }
}
