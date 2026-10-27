import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ClinicService, ServiceCategory } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { VetField } from '../form-field/form-field.component';
import { VetModal } from '../modal/modal.component';
import { VetSwitch } from '../switch/switch.component';

export const CATEGORIES: ServiceCategory[] = ['Consulta', 'Vacunación', 'Estética', 'Laboratorio', 'Cirugía', 'Otro'];

export type ServiceInput = Omit<ClinicService, 'id' | 'active'>;

/** "Nuevo servicio" / "Editar servicio" del catálogo. Cierra con los datos del formulario. */
@Component({
  selector: 'vet-service-dialog',
  imports: [ReactiveFormsModule, VetModal, VetField, VetSwitch],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <vet-modal [title]="service ? 'Editar servicio' : 'Nuevo servicio'" subtitle="Lo que ofreces y cuánto cuesta. Los marcados “En línea” se pueden pedir desde la app.">
        <vet-field label="Nombre" for="sv-name" [control]="form.controls.name" [messages]="{ taken: 'Ya tienes un servicio con ese nombre.' }">
          <input id="sv-name" class="vet-input" formControlName="name" placeholder="Ej. Consulta general" autocomplete="off" />
        </vet-field>
        <div class="row">
          <vet-field label="Categoría" for="sv-cat" [control]="form.controls.category">
            <select id="sv-cat" class="vet-input" formControlName="category">
              @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </vet-field>
          <vet-field label="Duración (min)" for="sv-min" [control]="form.controls.minutes" [messages]="{ min: 'Mínimo 5 minutos.', max: 'Máximo 480 minutos.' }">
            <input id="sv-min" class="vet-input" type="number" min="5" max="480" step="5" formControlName="minutes" />
          </vet-field>
        </div>
        <vet-field label="Precio (COP)" for="sv-price" [control]="form.controls.price" [messages]="{ min: 'El precio no puede ser negativo.' }">
          <input id="sv-price" class="vet-input" type="number" min="0" step="1000" formControlName="price" />
        </vet-field>
        <fieldset>
          <legend>Quién lo presta</legend>
          @for (p of store.professionals; track p.id) {
            <label class="check"><input type="checkbox" [checked]="has(p.id)" (change)="toggle(p.id)" />{{ p.name }}</label>
          }
          @if (!form.controls.professionalIds.value.length && form.touched) {
            <p class="error" role="alert">Elige al menos un profesional.</p>
          }
        </fieldset>
        <div class="switch">
          <span><strong>En línea</strong><small>Los dueños vinculados lo ven y piden cita desde la app.</small></span>
          <vet-switch [checked]="form.controls.online.value" (checkedChange)="form.controls.online.setValue($event)" label="Se puede pedir desde la app" />
        </div>
        <ng-container footer>
          <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
          <button type="submit" class="btn">{{ service ? 'Guardar cambios' : 'Crear servicio' }}</button>
        </ng-container>
      </vet-modal>
    </form>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    fieldset { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: 6px; padding: 0; font: 700 16px/1.3 'Afacad', sans-serif; }
    .check { display: flex; align-items: center; gap: 8px; font: 500 14px/1.3 'Afacad', sans-serif; }
    .check input { width: 16px; height: 16px; accent-color: #4037be; }
    .error { margin: 0; color: #b42318; font: 700 12px/1.3 'Afacad', sans-serif; }
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
export class ServiceDialog {
  protected readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<ServiceDialog, ServiceInput>>(MatDialogRef);
  protected readonly service = inject<ClinicService | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly categories = CATEGORIES;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.service?.name ?? '', [Validators.required, Validators.minLength(2), (c: { value: string }) => this.taken(c.value)]],
    category: [(this.service?.category ?? 'Consulta') as ServiceCategory, [Validators.required]],
    minutes: [this.service?.minutes ?? this.store.profile().defaultMinutes, [Validators.required, Validators.min(5), Validators.max(480)]],
    price: [this.service?.price ?? 0, [Validators.required, Validators.min(0)]],
    online: [this.service?.online ?? true],
    professionalIds: [this.service?.professionalIds ?? [this.store.professionals[0].id]],
  });

  private taken(name: string) {
    const n = name.trim().toLowerCase();
    return this.store.catalog().some((s) => s.id !== this.service?.id && s.name.toLowerCase() === n) ? { taken: true } : null;
  }

  protected has(id: string): boolean {
    return this.form.controls.professionalIds.value.includes(id);
  }

  protected toggle(id: string): void {
    const ids = this.form.controls.professionalIds.value;
    this.form.controls.professionalIds.setValue(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
    this.form.markAsTouched();
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.professionalIds.value.length) return;
    const v = this.form.getRawValue();
    this.ref.close({ name: v.name.trim(), category: v.category, minutes: Number(v.minutes), price: Number(v.price), online: v.online, professionalIds: v.professionalIds });
  }
}
