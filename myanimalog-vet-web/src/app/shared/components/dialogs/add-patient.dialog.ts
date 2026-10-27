import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Species } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { phoneValidator } from '../../validators/common';
import { VetField } from '../form-field/form-field.component';

type Mode = 'menu' | 'link' | 'manual';

/** "Agregar paciente" (Figma 1961:219): código QR, enviar enlace o registrar sin app. */
@Component({
  selector: 'vet-add-patient-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatIconModule, VetField],
  template: `
    <h2 mat-dialog-title>Agregar paciente</h2>
    <mat-dialog-content class="content">
      @switch (mode()) {
        @case ('menu') {
          <p class="lead">Elige cómo vincular a la mascota con tu clínica.</p>
          <button type="button" class="option" (click)="copyCode()">
            <mat-icon fontSet="material-icons-outlined">qr_code_2</mat-icon>
            <span><strong>Código de vinculación</strong><small>El dueño lo escanea o lo escribe en la app: {{ store.linkCode() ?? 'sin código activo' }}</small></span>
            <span class="chip">Copiar</span>
          </button>
          <button type="button" class="option" (click)="mode.set('link')">
            <mat-icon fontSet="material-icons-outlined">mail_outline</mat-icon>
            <span><strong>Enviar enlace</strong><small>Le llega un correo para que se una desde la app</small></span>
          </button>
          <button type="button" class="option" (click)="mode.set('manual')">
            <mat-icon fontSet="material-icons-outlined">edit_note</mat-icon>
            <span><strong>Registrar sin app</strong><small>Tú llenas los datos; el dueño la reclama después</small></span>
          </button>
        }
        @case ('link') {
          <form [formGroup]="linkForm" (ngSubmit)="sendLink()" id="link-form" novalidate>
            <vet-field label="Correo del dueño" for="ap-email" [control]="linkForm.controls.email">
              <input id="ap-email" class="vet-input" type="email" formControlName="email" placeholder="dueno@correo.com" />
            </vet-field>
          </form>
        }
        @case ('manual') {
          <form [formGroup]="form" (ngSubmit)="save()" id="manual-form" class="grid" novalidate>
            <vet-field label="Nombre de la mascota" for="ap-name" [control]="form.controls.name"><input id="ap-name" class="vet-input" formControlName="name" /></vet-field>
            <vet-field label="Especie" for="ap-species" [control]="form.controls.species">
              <select id="ap-species" class="vet-input" formControlName="species">
                <option value="Perro">Perro</option><option value="Gato">Gato</option><option value="Otro">Otro</option>
              </select>
            </vet-field>
            <vet-field label="Raza" for="ap-breed" [control]="form.controls.breed"><input id="ap-breed" class="vet-input" formControlName="breed" /></vet-field>
            <vet-field label="Edad" for="ap-age" [control]="form.controls.age"><input id="ap-age" class="vet-input" formControlName="age" placeholder="3 años" /></vet-field>
            <vet-field label="Dueño" for="ap-owner" [control]="form.controls.owner"><input id="ap-owner" class="vet-input" formControlName="owner" /></vet-field>
            <vet-field label="Teléfono" for="ap-phone" [control]="form.controls.phone"><input id="ap-phone" class="vet-input" type="tel" formControlName="phone" placeholder="3001234567" /></vet-field>
          </form>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (mode() === 'menu') {
        <button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cerrar</button>
      } @else {
        <button type="button" class="vet-btn vet-btn--secondary" (click)="mode.set('menu')">Atrás</button>
        <button type="submit" class="vet-btn vet-btn--primary" [attr.form]="mode() === 'link' ? 'link-form' : 'manual-form'">
          {{ mode() === 'link' ? 'Enviar enlace' : 'Registrar paciente' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: flex; flex-direction: column; gap: 10px; min-width: min(460px, 80vw); padding: 8px 24px 12px !important; }
    .lead { margin: 0 0 4px; color: var(--vet-text-2); font: 500 14px/1.4 'Afacad', sans-serif; }
    .option { display: flex; align-items: center; gap: 14px; padding: 14px; border: 2px solid #000; border-radius: 8px; background: #fff; text-align: left; cursor: pointer; font: 500 14px/1.3 'Afacad', sans-serif; }
    .option:hover { background: var(--vet-soft-2); }
    .option:focus-visible { outline: 2px solid var(--vet-primary); outline-offset: 2px; }
    .option mat-icon { flex: none; color: var(--vet-primary); }
    .option span:not(.chip) { display: flex; flex: 1; flex-direction: column; }
    .option small { color: var(--vet-text-2); font-size: 12px; }
    .chip { padding: 4px 10px; border-radius: 999px; background: var(--vet-soft); color: var(--vet-primary); font: 700 12px/1 'Afacad', sans-serif; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    mat-dialog-actions { padding: 8px 24px 20px; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AddPatientDialog {
  protected readonly store = inject(ClinicStore);
  private readonly ref = inject<MatDialogRef<AddPatientDialog, boolean>>(MatDialogRef);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly mode = signal<Mode>('menu');
  protected readonly linkForm = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    species: ['Perro' as Species, [Validators.required]],
    breed: ['', [Validators.required]],
    age: ['', [Validators.required]],
    owner: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, phoneValidator]],
  });

  protected copyCode(): void {
    const code = this.store.linkCode();
    if (!code) {
      this.snack.open('No hay un código activo. Genera uno en Mi clínica.', 'Cerrar', { duration: 3000 });
      return;
    }
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    this.snack.open(`Código ${code} copiado`, 'Cerrar', { duration: 3000 });
  }

  protected sendLink(): void {
    this.linkForm.markAllAsTouched();
    if (this.linkForm.invalid) return;
    this.snack.open(`Enlace enviado a ${this.linkForm.getRawValue().email}`, 'Cerrar', { duration: 3500 });
    this.ref.close(true);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.store.addPatient({ ...v, name: v.name.trim(), owner: v.owner.trim() });
    this.snack.open(`${v.name} quedó registrado`, 'Cerrar', { duration: 3500 });
    this.ref.close(true);
  }
}
