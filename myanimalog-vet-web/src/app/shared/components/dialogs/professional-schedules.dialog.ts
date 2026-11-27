import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { errorMessage } from '@services/api-error';
import { ScheduleDay } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { catchError, forkJoin, of } from 'rxjs';
import { VetModal } from '../modal/modal.component';

/** Días de cada opción (0 = lunes … 6 = domingo, como el horario del panel). */
const PRESETS: Record<string, number[]> = {
  'Lun a vie': [0, 1, 2, 3, 4],
  'Lun a sáb': [0, 1, 2, 3, 4, 5],
  'Mar a sáb': [1, 2, 3, 4, 5],
  'Lun a dom': [0, 1, 2, 3, 4, 5, 6],
};
const CLINIC = 'Horario de la clínica';
const CUSTOM = 'Personalizado';

const label = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

interface Row {
  id: string;
  name: string;
  roleLabel: string;
  /** `CLINIC`, una clave de `PRESETS` o `CUSTOM` (lo que tenía guardado y no cabe en una opción). */
  mode: string;
  from: string;
  to: string;
  /** Lo que llegó del servidor, para no reescribir un horario "Personalizado" que no se tocó. */
  original: ScheduleDay[] | null;
  dirty: boolean;
}

/** Lee un horario guardado y lo resume en una opción del selector. */
function rowMode(days: ScheduleDay[] | null): Pick<Row, 'mode' | 'from' | 'to'> {
  if (!days) return { mode: CLINIC, from: '08:00', to: '17:00' };
  const open = days.filter((d) => d.open && d.ranges.length);
  if (!open.length) return { mode: CLINIC, from: '08:00', to: '17:00' };
  const [from, to] = [open[0].ranges[0][0], open[0].ranges[open[0].ranges.length - 1][1]];
  const same = open.every((d) => d.ranges.length === 1 && d.ranges[0][0] === from && d.ranges[0][1] === to);
  const idx = open.map((d) => d.day).join(',');
  const preset = Object.entries(PRESETS).find(([, list]) => list.join(',') === idx)?.[0];
  return { mode: same && preset ? preset : CUSTOM, from, to };
}

/**
 * "Horarios por profesional" (Postman carpeta 17): en qué días y horas atiende cada persona. Sin horario propio
 * atiende en el de la clínica. Calendar cruza este horario con el de la clínica para ofrecer horas libres.
 */
@Component({
  selector: 'vet-professional-schedules-dialog',
  imports: [VetModal],
  template: `
    <vet-modal title="Horarios por profesional" subtitle="Cuándo atiende cada persona. Si no tiene horario propio, atiende en el de la clínica.">
      @if (loading()) {
        <p class="muted">Cargando horarios…</p>
      } @else {
        <div class="rows">
          @for (r of rows(); track r.id; let i = $index) {
            <div class="row">
              <span class="who"><strong>{{ r.name }}</strong><small>{{ r.roleLabel }}</small></span>
              <select [value]="r.mode" (change)="set(i, 'mode', $event)" [attr.aria-label]="'Días de ' + r.name">
                @for (p of modes(r); track p) { <option [value]="p" [selected]="p === r.mode">{{ p }}</option> }
              </select>
              @if (r.mode !== clinic) {
                <input type="time" [value]="r.from" [disabled]="r.mode === custom" (change)="set(i, 'from', $event)" [attr.aria-label]="'Entrada de ' + r.name" />
                –
                <input type="time" [value]="r.to" [disabled]="r.mode === custom" (change)="set(i, 'to', $event)" [attr.aria-label]="'Salida de ' + r.name" />
              }
            </div>
          } @empty {
            <p class="muted pad">No hay profesionales activos en el equipo.</p>
          }
        </div>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <ng-container footer>
        <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
        <button type="button" class="btn" [disabled]="loading() || saving()" (click)="save()">{{ saving() ? 'Guardando…' : 'Guardar horarios' }}</button>
      </ng-container>
    </vet-modal>
  `,
  styles: `
    :host { display: block; width: min(680px, 94vw); }
    .rows { display: flex; flex-direction: column; border: 1.5px solid #e6e4f5; border-radius: 10px; }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #e6e4f5; font: 500 14px/1 'Afacad', sans-serif; }
    .row:last-child { border-bottom: 0; }
    .who { display: flex; flex: 1; min-width: 160px; flex-direction: column; gap: 1px; }
    .who strong { font: 700 14px/1.3 'Afacad', sans-serif; }
    .who small { color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    select, input { height: 32px; padding: 0 4px; border: 1.5px solid #e6e4f5; border-radius: 6px; font: 500 13px/1 'Afacad', sans-serif; }
    select:focus-visible, input:focus-visible { outline: 2px solid #4037be; }
    input[type='time'] { width: 96px; }
    input:disabled { background: #f7f7fa; color: #8a8a9a; }
    .muted { margin: 0; color: #8a8a9a; font: 500 13px/1.4 'Afacad', sans-serif; }
    .pad { padding: 14px; }
    .error { margin: 0; color: #b42318; font: 700 13px/1.3 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn:disabled { opacity: 0.6; cursor: default; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalSchedulesDialog {
  private readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<ProfessionalSchedulesDialog, boolean>>(MatDialogRef);
  protected readonly clinic = CLINIC;
  protected readonly custom = CUSTOM;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly rows = signal<Row[]>([]);

  constructor() {
    const members = this.store.members().filter((m) => m.active && m.role !== 'RECEPTION');
    if (!members.length) {
      this.loading.set(false);
      return;
    }
    forkJoin(members.map((m) => this.store.memberSchedule(m.id).pipe(catchError(() => of(null))))).subscribe((schedules) => {
      this.rows.set(members.map((m, i) => ({ id: m.id, name: m.name, roleLabel: m.roleLabel, ...rowMode(schedules[i]), original: schedules[i], dirty: false })));
      this.loading.set(false);
    });
  }

  protected modes(r: Row): string[] {
    return [CLINIC, ...Object.keys(PRESETS), ...(r.mode === CUSTOM ? [CUSTOM] : [])];
  }

  protected set(i: number, key: 'mode' | 'from' | 'to', e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.rows.update((list) => list.map((r, idx) => (idx === i ? { ...r, [key]: value, dirty: true } : r)));
  }

  protected save(): void {
    this.error.set('');
    const changed = this.rows().filter((r) => r.dirty && r.mode !== CUSTOM);
    const bad = changed.find((r) => r.mode !== CLINIC && (!r.from || !r.to || r.to <= r.from));
    if (bad) {
      this.error.set(`${bad.name}: la hora de salida debe ser después de la de entrada.`);
      return;
    }
    if (!changed.length) {
      this.ref.close(false);
      return;
    }
    this.saving.set(true);
    forkJoin(changed.map((r) => this.store.saveMemberSchedule(r.id, this.daysOf(r)))).subscribe({
      next: () => {
        for (const r of changed) this.store.setMemberSchedule(r.id, r.mode === CLINIC ? CLINIC : `${r.mode} · ${label(r.from)} – ${label(r.to)}`);
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(errorMessage(e, 'No pudimos guardar los horarios. Inténtalo de nuevo.'));
      },
    });
  }

  /** `null` = vuelve al horario de la clínica. */
  private daysOf(r: Row): ScheduleDay[] | null {
    if (r.mode === CLINIC) return null;
    const open = PRESETS[r.mode] ?? [];
    return Array.from({ length: 7 }, (_, day) => ({ day, open: open.includes(day), ranges: open.includes(day) ? [[r.from, r.to] as [string, string]] : [] }));
  }
}
