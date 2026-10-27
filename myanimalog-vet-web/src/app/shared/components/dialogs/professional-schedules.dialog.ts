import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ClinicStore } from '@services/clinic/clinic.store';
import { VetModal } from '../modal/modal.component';

const PRESETS = ['Lun a vie', 'Lun a sáb', 'Mar a sáb', 'Lun a dom'];

const label = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};
const parseTime = (text: string): string => {
  const m = /(\d{1,2}):(\d{2})\s*([ap])\./.exec(text);
  if (!m) return '08:00';
  let h = Number(m[1]) % 12;
  if (m[3] === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

interface Row {
  id: string;
  name: string;
  roleLabel: string;
  preset: string;
  from: string;
  to: string;
}

/** "Horarios por profesional": en qué días y horas atiende cada persona del equipo. */
@Component({
  selector: 'vet-professional-schedules-dialog',
  imports: [VetModal],
  template: `
    <vet-modal title="Horarios por profesional" subtitle="Cuándo atiende cada persona. Se muestra en su ficha de Equipo.">
      <div class="rows">
        @for (r of rows(); track r.id; let i = $index) {
          <div class="row">
            <span class="who"><strong>{{ r.name }}</strong><small>{{ r.roleLabel }}</small></span>
            <select [value]="r.preset" (change)="set(i, 'preset', $event)" [attr.aria-label]="'Días de ' + r.name">
              @for (p of presets; track p) { <option [value]="p" [selected]="p === r.preset">{{ p }}</option> }
            </select>
            <input type="time" [value]="r.from" (change)="set(i, 'from', $event)" [attr.aria-label]="'Entrada de ' + r.name" />
            –
            <input type="time" [value]="r.to" (change)="set(i, 'to', $event)" [attr.aria-label]="'Salida de ' + r.name" />
          </div>
        }
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <ng-container footer>
        <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
        <button type="button" class="btn" (click)="save()">Guardar horarios</button>
      </ng-container>
    </vet-modal>
  `,
  styles: `
    :host { display: block; width: min(640px, 94vw); }
    .rows { display: flex; flex-direction: column; border: 1.5px solid #e6e4f5; border-radius: 10px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #e6e4f5; font: 500 14px/1 'Afacad', sans-serif; }
    .row:last-child { border-bottom: 0; }
    .who { display: flex; flex: 1; flex-direction: column; gap: 1px; }
    .who strong { font: 700 14px/1.3 'Afacad', sans-serif; }
    .who small { color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    select, input { height: 32px; padding: 0 4px; border: 1.5px solid #e6e4f5; border-radius: 6px; font: 500 13px/1 'Afacad', sans-serif; }
    select:focus-visible, input:focus-visible { outline: 2px solid #4037be; }
    input[type='time'] { width: 86px; }
    input::-webkit-calendar-picker-indicator { display: none; }
    .error { margin: 0; color: #b42318; font: 700 13px/1.3 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalSchedulesDialog {
  private readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<ProfessionalSchedulesDialog, boolean>>(MatDialogRef);
  protected readonly presets = PRESETS;
  protected readonly error = signal('');

  protected readonly rows = signal<Row[]>(
    this.store
      .members()
      .filter((m) => m.active && m.role !== 'RECEPTION')
      .map((m) => {
        const [days, hours] = m.schedule.split(' · ');
        const [a, b] = (hours ?? '').split('–');
        return { id: m.id, name: m.name, roleLabel: m.roleLabel, preset: PRESETS.includes(days) ? days : 'Lun a vie', from: parseTime(a ?? ''), to: parseTime(b ?? '') };
      }),
  );
  readonly count = computed(() => this.rows().length);

  protected set(i: number, key: 'preset' | 'from' | 'to', e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.rows.update((list) => list.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  protected save(): void {
    const bad = this.rows().find((r) => !r.from || !r.to || r.to <= r.from);
    if (bad) {
      this.error.set(`${bad.name}: la hora de salida debe ser después de la de entrada.`);
      return;
    }
    for (const r of this.rows()) this.store.setMemberSchedule(r.id, `${r.preset} · ${label(r.from)} – ${label(r.to)}`);
    this.ref.close(true);
  }
}
