import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ScheduleDay } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { VetModal } from '../modal/modal.component';
import { VetSwitch } from '../switch/switch.component';

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Row {
  day: number;
  open: boolean;
  a: [string, string];
  b: [string, string] | null;
}

/** "Horario de atención": días y tramos (hasta dos por día, por ejemplo mañana y tarde). */
@Component({
  selector: 'vet-schedule-dialog',
  imports: [VetModal, VetSwitch],
  template: `
    <vet-modal title="Horario de atención" subtitle="Cuándo atiende la clínica. Fuera de este horario no se pueden agendar citas.">
      <div class="rows">
        @for (r of rows(); track r.day; let i = $index) {
          <div class="row" [class.closed]="!r.open">
            <vet-switch [checked]="r.open" (checkedChange)="update(i, { open: $event })" [label]="'Abierto el ' + names[r.day]" />
            <strong>{{ names[r.day] }}</strong>
            @if (r.open) {
              <span class="times">
                <input type="time" [value]="r.a[0]" (change)="setTime(i, 'a', 0, $event)" [attr.aria-label]="names[r.day] + ': abre'" />
                –
                <input type="time" [value]="r.a[1]" (change)="setTime(i, 'a', 1, $event)" [attr.aria-label]="names[r.day] + ': cierra'" />
                @if (r.b) {
                  <em>·</em>
                  <input type="time" [value]="r.b[0]" (change)="setTime(i, 'b', 0, $event)" [attr.aria-label]="names[r.day] + ': reabre'" />
                  –
                  <input type="time" [value]="r.b[1]" (change)="setTime(i, 'b', 1, $event)" [attr.aria-label]="names[r.day] + ': cierra en la tarde'" />
                  <button type="button" class="link" (click)="update(i, { b: null })">Quitar tramo</button>
                } @else {
                  <button type="button" class="link" (click)="update(i, { b: ['14:00', '18:00'] })">+ Agregar tramo</button>
                }
              </span>
            } @else {
              <span class="muted">Cerrado</span>
            }
          </div>
        }
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <ng-container footer>
        <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
        <button type="button" class="btn" (click)="save()">Guardar horario</button>
      </ng-container>
    </vet-modal>
  `,
  styles: `
    :host { display: block; width: min(720px, 94vw); }
    .rows { display: flex; flex-direction: column; border: 1.5px solid #e6e4f5; border-radius: 10px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #e6e4f5; }
    .row:last-child { border-bottom: 0; }
    .row strong { width: 84px; font: 700 14px/1.3 'Afacad', sans-serif; }
    .times { display: flex; align-items: center; gap: 6px; font: 500 14px/1 'Afacad', sans-serif; }
    .times em { font-style: normal; color: #8a8a9a; }
    .times input { width: 86px; height: 32px; padding: 0 4px; border: 1.5px solid #e6e4f5; border-radius: 6px; font: 500 13px/1 'Afacad', sans-serif; }
    .times input:focus-visible { outline: 2px solid #4037be; }
    .times input::-webkit-calendar-picker-indicator { display: none; }
    .muted { color: #8a8a9a; font: 500 13px/1 'Afacad', sans-serif; }
    .link { flex: none; white-space: nowrap; padding: 0 0 0 6px; border: 0; background: none; color: #4037be; font: 700 12px/1 'Afacad', sans-serif; cursor: pointer; }
    .error { margin: 0; color: #b42318; font: 700 13px/1.3 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleDialog {
  private readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<ScheduleDialog, boolean>>(MatDialogRef);
  protected readonly names = DAY_NAMES;
  protected readonly error = signal('');

  protected readonly rows = signal<Row[]>(
    this.store.schedule().map((d) => ({ day: d.day, open: d.open, a: d.ranges[0] ?? ['08:00', '12:00'], b: d.ranges[1] ?? null })),
  );

  protected update(i: number, patch: Partial<Row>): void {
    this.rows.update((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  protected setTime(i: number, which: 'a' | 'b', pos: 0 | 1, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.rows.update((list) =>
      list.map((r, idx) => {
        if (idx !== i) return r;
        const range = [...(r[which] ?? ['', ''])] as [string, string];
        range[pos] = value;
        return { ...r, [which]: range };
      }),
    );
  }

  protected save(): void {
    for (const r of this.rows()) {
      if (!r.open) continue;
      const name = this.names[r.day];
      const ranges = [r.a, r.b].filter((x): x is [string, string] => !!x);
      if (ranges.some(([from, to]) => !from || !to || to <= from)) return this.error.set(`${name}: la hora de cierre debe ser después de la de apertura.`);
      if (ranges.length === 2 && ranges[1][0] < ranges[0][1]) return this.error.set(`${name}: el segundo tramo debe empezar después de que termine el primero.`);
    }
    const days: ScheduleDay[] = this.rows().map((r) => ({ day: r.day, open: r.open, ranges: r.open ? ([r.a, r.b].filter(Boolean) as [string, string][]) : [] }));
    this.store.setSchedule(days);
    this.ref.close(true);
  }
}
