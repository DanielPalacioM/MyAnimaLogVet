import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SessionService } from '@auth/services/session.service';
import { MemberRole } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { VetField } from '../form-field/form-field.component';
import { VetModal } from '../modal/modal.component';
import { RolePicker } from '../role-picker/role-picker.component';

/** "Invitar a tu equipo" (Figma 1966:630): correo y rol; la invitación vence en 7 días. */
@Component({
  selector: 'vet-invite-colleague-dialog',
  imports: [ReactiveFormsModule, VetModal, VetField, RolePicker],
  template: `
    <form [formGroup]="form" (ngSubmit)="send()" novalidate>
      <vet-modal title="Invitar a tu equipo" [subtitle]="'Le llega un correo para unirse a ' + clinicName() + '. La invitación vence en 7 días.'">
        <vet-field label="Correo" for="ic-email" [control]="form.controls.email">
          <input id="ic-email" class="vet-input" type="email" formControlName="email" placeholder="nombre@correo.com" autocomplete="off" />
        </vet-field>
        <h3 class="role-title" id="ic-role">Rol</h3>
        <vet-role-picker [value]="role()" (valueChange)="role.set($event)" label="Rol" />
        <p class="note">Dueño no se puede asignar por invitación: se cambia con "Transferir propiedad". La invitación cuenta para el límite de usuarios de tu plan.</p>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <ng-container footer>
          <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
          <button type="submit" class="btn">Enviar invitación</button>
        </ng-container>
      </vet-modal>
    </form>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    .role-title { margin: 0; font: 700 16px/1.3 'Afacad', sans-serif; }
    .note { margin: 0; color: #8a8a9a; font: 500 12px/1.35 'Afacad', sans-serif; }
    .error { margin: 0; color: #b42318; font: 700 13px/1.3 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class InviteColleagueDialog {
  protected readonly ref = inject<MatDialogRef<InviteColleagueDialog, boolean>>(MatDialogRef);
  private readonly snack = inject(MatSnackBar);
  private readonly store = inject(ClinicStore);
  private readonly session = inject(SessionService);

  protected readonly role = signal<MemberRole>('VET');
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected clinicName(): string {
    return this.session.clinic()?.veterinaryName ?? 'tu clínica';
  }

  protected send(): void {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const email = this.form.controls.email.value.trim();
    const problem = this.store.invite(email, this.role(), this.session.user()?.fullName ?? 'Administrador');
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.snack.open(`Invitación enviada a ${email}`, 'Cerrar', { duration: 3500 });
    this.ref.close(true);
  }
}
