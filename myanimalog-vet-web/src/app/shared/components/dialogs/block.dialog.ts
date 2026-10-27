import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ClinicBlock } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { isoDate, startOfDay } from '@services/clinic/date.utils';
import { VetField } from '../form-field/form-field.component';
import { VetModal } from '../modal/modal.component';
import { VetSwitch } from '../switch/switch.component';

export type BlockInput = Omit<ClinicBlock, 'id'>;

/** "Agregar bloqueo": festivos, cirugías, vacaciones… Esas horas no se pueden agendar. */
@Component({
  selector: 'vet-block-dialog',
  imports: [ReactiveFormsModule, VetModal, VetField, VetSwitch],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <vet-modal title="Agregar bloqueo" subtitle="En esas horas no se podrán agendar citas, ni desde la clínica ni desde la app.">
        <vet-field label="Motivo" for="bl-title" [control]="form.controls.title">
          <input id="bl-title" class="vet-input" formControlName="title" placeholder="Ej. Festivo, Cirugía programada, Vacaciones" autocomplete="off" />
        </vet-field>
        <vet-field label="Aplica a" for="bl-scope" [control]="form.controls.scope">
          <select id="bl-scope" class="vet-input" formControlName="scope">
            <option value="CLINIC">Toda la clínica</option>
            @for (p of store.professionals; track p.id) { <option [value]="p.id">{{ p.name }}</option> }
          </select>
        </vet-field>
        <div class="row">
          <vet-field label="Desde" for="bl-from" [control]="form.controls.date" [messages]="{ past: 'Elige hoy o una fecha futura.' }">
            <input id="bl-from" class="vet-input" type="date" formControlName="date" [min]="today" />
          </vet-field>
          <vet-field label="Hasta" for="bl-to" [control]="form.controls.endDate" [optional]="true" [messages]="{ order: 'Debe ser igual o posterior a “Desde”.' }">
            <input id="bl-to" class="vet-input" type="date" formControlName="endDate" [min]="form.controls.date.value || today" />
          </vet-field>
        </div>
        <div class="switch">
          <span><strong>Todo el día</strong><small>Si lo apagas, eliges las horas.</small></span>
          <vet-switch [checked]="form.controls.allDay.value" (checkedChange)="setAllDay($event)" label="Bloquear todo el día" />
        </div>
        @if (!form.controls.allDay.value) {
          <div class="row">
            <vet-field label="Hora inicial" for="bl-h1" [control]="form.controls.from"><input id="bl-h1" class="vet-input" type="time" formControlName="from" /></vet-field>
            <vet-field label="Hora final" for="bl-h2" [control]="form.controls.to" [messages]="{ order: 'Debe ser después de la inicial.' }"><input id="bl-h2" class="vet-input" type="time" formControlName="to" /></vet-field>
          </div>
        }
        <ng-container footer>
          <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
          <button type="submit" class="btn">Agregar bloqueo</button>
        </ng-container>
      </vet-modal>
    </form>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1.5px solid #e6e4f5; border-radius: 10px; }
    .switch span { display: flex; flex-direction: column; gap: 2px; }
    .switch strong { font: 700 14px/1.3 'Afacad', sans-serif; }
    .switch small { color: #404040; font: 500 12px/1.3 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class BlockDialog {
  protected readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<BlockDialog, BlockInput>>(MatDialogRef);
  protected readonly today = isoDate(Date.now());

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    scope: ['CLINIC', [Validators.required]],
    date: [this.today, [Validators.required]],
    endDate: [''],
    allDay: [true],
    from: ['09:00'],
    to: ['10:00'],
  });

  protected setAllDay(value: boolean): void {
    this.form.controls.allDay.setValue(value);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    this.form.controls.date.setErrors(v.date && v.date < this.today ? { past: true } : null);
    this.form.controls.endDate.setErrors(v.endDate && v.endDate < v.date ? { order: true } : null);
    this.form.controls.to.setErrors(!v.allDay && v.to <= v.from ? { order: true } : null);
    if (this.form.invalid) return;
    const date = startOfDay(new Date(`${v.date}T00:00:00`).getTime());
    const endDate = v.endDate && v.endDate !== v.date ? startOfDay(new Date(`${v.endDate}T00:00:00`).getTime()) : undefined;
    this.ref.close({ title: v.title.trim(), scope: v.scope, date, endDate, allDay: v.allDay, from: v.allDay ? undefined : v.from, to: v.allDay ? undefined : v.to });
  }
}
