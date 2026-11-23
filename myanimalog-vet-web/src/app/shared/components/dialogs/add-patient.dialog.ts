import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { errorMessage } from '@services/api-error';
import { Species } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { inviteMessage, inviteUrl, mailtoUrl } from '@services/clinic/invite-link';
import { FEATURE_MESSAGE, FEATURES } from '@services/features';
import { phoneValidator } from '../../validators/common';
import { VetField } from '../form-field/form-field.component';

type Mode = 'menu' | 'link' | 'manual';

/** "Agregar paciente": código de vinculación, enviar el código por correo o registrar la mascota sin app (el dueño la reclama). */
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
            <span><strong>Enviar el código por correo</strong><small>Se abre tu correo con el mensaje listo: el dueño se une desde la app</small></span>
          </button>
          <button type="button" class="option" [disabled]="!manualAvailable" (click)="mode.set('manual')">
            <mat-icon fontSet="material-icons-outlined">edit_note</mat-icon>
            <span>
              <strong>Registrar sin app</strong>
              <small>{{ manualAvailable ? 'Tú llenas los datos y el dueño reclama la mascota desde un correo' : manualMessage }}</small>
            </span>
            @if (!manualAvailable) { <span class="chip chip--soon">Pronto</span> }
          </button>
        }
        @case ('link') {
          <form [formGroup]="linkForm" (ngSubmit)="sendLink()" id="link-form" novalidate>
            <vet-field label="Correo del dueño" for="ap-email" [control]="linkForm.controls.email" hint="Se abre tu programa de correo con el código y el enlace para vincularse.">
              <input id="ap-email" class="vet-input" type="email" formControlName="email" placeholder="dueno@correo.com" autocomplete="off" />
            </vet-field>
            @if (!store.linkCode()) {
              <p class="reg-alert reg-alert--error" role="alert">No hay un código activo. Genera uno en “Mi clínica” antes de enviarlo.</p>
            }
          </form>
        }
        @case ('manual') {
          <form [formGroup]="form" (ngSubmit)="save()" id="manual-form" novalidate>
            <h3 class="part">La mascota</h3>
            <div class="grid">
              <vet-field label="Nombre" for="ap-name" [control]="form.controls.name"><input id="ap-name" class="vet-input" formControlName="name" autocomplete="off" /></vet-field>
              <vet-field label="Especie" for="ap-species" [control]="form.controls.species">
                <select id="ap-species" class="vet-input" formControlName="species">
                  <option value="Perro">Perro</option><option value="Gato">Gato</option><option value="Otro">Otro</option>
                </select>
              </vet-field>
              <vet-field label="Raza" for="ap-breed" [control]="form.controls.breed"><input id="ap-breed" class="vet-input" formControlName="breed" autocomplete="off" /></vet-field>
              <vet-field label="Sexo (opcional)" for="ap-sex" [control]="form.controls.sex">
                <select id="ap-sex" class="vet-input" formControlName="sex">
                  <option value="">Sin indicar</option><option value="Macho">Macho</option><option value="Hembra">Hembra</option>
                </select>
              </vet-field>
              <vet-field label="Nacimiento (opcional)" for="ap-birth" [control]="form.controls.birthDate">
                <input id="ap-birth" class="vet-input" type="date" formControlName="birthDate" [max]="today" />
              </vet-field>
            </div>
            <h3 class="part">El dueño</h3>
            <div class="grid">
              <vet-field label="Nombre completo" for="ap-owner" [control]="form.controls.ownerName"><input id="ap-owner" class="vet-input" formControlName="ownerName" autocomplete="off" /></vet-field>
              <vet-field label="Teléfono (opcional)" for="ap-phone" [control]="form.controls.ownerPhone"><input id="ap-phone" class="vet-input" type="tel" formControlName="ownerPhone" placeholder="3001234567" /></vet-field>
              <vet-field class="wide" label="Correo" for="ap-oemail" [control]="form.controls.ownerEmail" hint="Aquí le llega la invitación para reclamar la mascota (vence en 30 días).">
                <input id="ap-oemail" class="vet-input" type="email" formControlName="ownerEmail" placeholder="dueno@correo.com" autocomplete="off" />
              </vet-field>
            </div>
            @if (error()) { <p class="reg-alert reg-alert--error" role="alert">{{ error() }}</p> }
          </form>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (mode() === 'menu') {
        <button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cerrar</button>
      } @else {
        <button type="button" class="vet-btn vet-btn--secondary" (click)="mode.set('menu')">Atrás</button>
        <button type="submit" class="vet-btn vet-btn--primary" [disabled]="saving()" [attr.form]="mode() === 'link' ? 'link-form' : 'manual-form'">
          {{ mode() === 'link' ? 'Abrir correo' : saving() ? 'Registrando…' : 'Registrar y enviar invitación' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: flex; flex-direction: column; gap: 10px; width: min(520px, 86vw); box-sizing: border-box; padding: 8px 24px 12px !important; }
    .lead { margin: 0 0 4px; color: var(--vet-text-2); font: 500 14px/1.4 'Afacad', sans-serif; }
    .option { display: flex; align-items: center; gap: 14px; padding: 14px; border: 2px solid #000; border-radius: 8px; background: #fff; text-align: left; cursor: pointer; font: 500 14px/1.3 'Afacad', sans-serif; }
    .option:hover:not(:disabled) { background: var(--vet-soft-2); }
    .option:focus-visible { outline: 2px solid var(--vet-primary); outline-offset: 2px; }
    .option:disabled { border-color: #c9c9d6; color: #6b6b80; cursor: not-allowed; background: #f7f7fa; }
    .option mat-icon { flex: none; color: var(--vet-primary); }
    .option:disabled mat-icon { color: #a0a0b0; }
    .option span:not(.chip) { display: flex; flex: 1; flex-direction: column; }
    .option small { color: var(--vet-text-2); font-size: 12px; }
    .chip { padding: 4px 10px; border-radius: 999px; background: var(--vet-soft); color: var(--vet-primary); font: 700 12px/1 'Afacad', sans-serif; }
    .chip--soon { background: #fff4e0; color: #8a5a00; }
    .part { margin: 4px 0 8px; font: 700 15px/1.2 'Afacad', sans-serif; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
    .grid .wide { grid-column: 1 / -1; }
    mat-dialog-actions { padding: 8px 24px 20px; gap: 8px; }
    @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AddPatientDialog {
  protected readonly store = inject(ClinicStore);
  private readonly ref = inject<MatDialogRef<AddPatientDialog, boolean>>(MatDialogRef);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly manualAvailable = FEATURES.patients;
  protected readonly manualMessage = FEATURE_MESSAGE.patients;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly mode = signal<Mode>('menu');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  private readonly clinicName = computed(() => this.store.profile()?.name ?? 'tu clínica');

  protected readonly linkForm = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    species: ['Perro' as Species, [Validators.required]],
    breed: ['', [Validators.required]],
    sex: [''],
    birthDate: [''],
    ownerName: ['', [Validators.required, Validators.minLength(3)]],
    ownerPhone: ['', [phoneValidator]],
    ownerEmail: ['', [Validators.required, Validators.email]],
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

  /** Abre el correo del usuario con el mensaje armado; no se manda nada por el servidor, así que no se dice que se envió. */
  protected sendLink(): void {
    this.linkForm.markAllAsTouched();
    const code = this.store.linkCode();
    if (this.linkForm.invalid || !code) return;
    const message = inviteMessage(this.clinicName(), code, inviteUrl(environment.ownerAppUrl, code));
    window.open(mailtoUrl(`Vincúlate a ${this.clinicName()} en MyAnimaLog`, message, this.linkForm.getRawValue().email.trim()), '_self');
    this.ref.close(true);
  }

  protected save(): void {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const today = this.today;
    if (v.birthDate && v.birthDate > today) {
      this.form.controls.birthDate.setErrors({ future: { message: 'La fecha no puede ser futura.' } });
      return;
    }
    this.saving.set(true);
    this.store
      .registerPatient({
        name: v.name,
        species: v.species,
        breed: v.breed,
        birthDate: v.birthDate || undefined,
        sex: (v.sex as 'Macho' | 'Hembra') || undefined,
        ownerName: v.ownerName,
        ownerEmail: v.ownerEmail,
        ownerPhone: v.ownerPhone || undefined,
      })
      .subscribe({
        next: (res) => {
          this.snack.open(`${v.name.trim()} quedó registrado. Invitación enviada a ${res.invitedEmail ?? v.ownerEmail.trim()}`, 'Cerrar', { duration: 4500 });
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.error.set(errorMessage(e, 'No pudimos registrar al paciente. Inténtalo de nuevo.'));
        },
        complete: () => this.saving.set(false),
      });
  }
}
