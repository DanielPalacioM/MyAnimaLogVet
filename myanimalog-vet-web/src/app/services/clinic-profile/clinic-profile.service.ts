import { computed, inject, Injectable } from '@angular/core';
import { ClinicStore } from '../clinic/clinic.store';
import { LEGAL } from '../clinic/clinic-settings.seed';
import { addDays, at, startOfDay } from '../clinic/date.utils';

const label = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};
const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const STOP = new Set(['clinica', 'clínica', 'veterinaria', 'veterinario', 'de', 'la', 'el', 'los', 'las']);

/** Datos de la vista Mi clínica que se calculan (estado "abierto", servicios en línea, iniciales). */
@Injectable({ providedIn: 'root' })
export class ClinicProfileService {
  private readonly store = inject(ClinicStore);

  readonly legal = LEGAL;
  readonly profile = this.store.profile;
  readonly clientsCount = computed(() => this.store.clients().length);

  /** Letra del logo: la primera palabra que no sea "Clínica Veterinaria". */
  initial(name: string): string {
    const word = name.split(/\s+/).find((w) => w && !STOP.has(w.toLowerCase()));
    return (word ?? name).charAt(0).toUpperCase() || 'C';
  }

  /** Categorías de los servicios que se pueden pedir desde la app (los chips de la vista previa). */
  readonly onlineCategories = computed(() => [...new Set(this.store.catalog().filter((s) => s.active && s.online).map((s) => s.category))]);

  /** "Abierto · cierra a las 6:00 p. m." o "Cerrado · abre mañana a las 8:00 a. m.". */
  readonly openNow = computed(() => {
    const now = this.store.now();
    if (!this.store.unavailableReason(now, 1)) {
      const d = new Date(now);
      const day = this.store.schedule().find((s) => s.day === (d.getDay() + 6) % 7);
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const range = day?.ranges.find(([a, b]) => hhmm >= a && hhmm < b);
      return { open: true, text: range ? `Abierto · cierra a las ${label(range[1])}` : 'Abierto' };
    }
    const today = startOfDay(now);
    for (let i = 0; i < 8; i++) {
      const date = addDays(today, i);
      const dow = (new Date(date).getDay() + 6) % 7;
      const day = this.store.schedule().find((s) => s.day === dow);
      for (const [from] of day?.ranges ?? []) {
        const start = at(date, from);
        if (start > now && !this.store.unavailableReason(start, 1)) {
          const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DAYS[dow]}`;
          return { open: false, text: `Cerrado · abre ${when} a las ${label(from)}` };
        }
      }
    }
    return { open: false, text: 'Cerrado' };
  });
}
