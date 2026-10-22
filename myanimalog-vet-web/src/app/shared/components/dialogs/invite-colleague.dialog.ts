import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VetField } from '../form-field/form-field.component';

/** "Invitar compañero": envía una invitación por correo con el rol elegido. */
@Component({
  selector: 'vet-invite-colleague-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, VetField],
  template: `
    <h2 mat-dialog-title>Invitar compañero</h2>
    <form [formGroup]="form" (ngSubmit)="send()" novalidate>
      <mat-dialog-content class="content">
        <vet-field label="Correo" for="ic-email" [control]="form.controls.email">
          <input id="ic-email" class="vet-input" type="email" formControlName="email" placeholder="companero@correo.com" />
        </vet-field>
        <vet-field label="Rol" for="ic-role" [control]="form.controls.role">
          <select id="ic-role" class="vet-input" formControlName="role">
            <option value="Médico veterinario">Médico veterinario</option>
            <option value="Asistente">Asistente</option>
            <option value="Recepción">Recepción</option>
            <option value="Administrador">Administrador</option>
          </select>
        </vet-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cancelar</button>
        <button type="submit" class="vet-btn vet-btn--primary">Enviar invitación</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content { display: flex; flex-direction: column; gap: 12px; min-width: min(420px, 80vw); padding: 8px 24px 12px !important; }
    mat-dialog-actions { padding: 8px 24px 20px; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class InviteColleagueDialog {
  private readonly ref = inject<MatDialogRef<InviteColleagueDialog, boolean>>(MatDialogRef);
  private readonly snack = inject(MatSnackBar);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['Médico veterinario', [Validators.required]],
  });

  protected send(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { email, role } = this.form.getRawValue();
    this.snack.open(`Invitación enviada a ${email} como ${role}`, 'Cerrar', { duration: 3500 });
    this.ref.close(true);
  }
}
