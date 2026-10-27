import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Member, MemberRole } from '@services/clinic/clinic.models';
import { VetModal } from '../modal/modal.component';
import { RolePicker } from '../role-picker/role-picker.component';

/** "Cambiar rol" de un miembro del equipo. Cierra con el rol elegido. */
@Component({
  selector: 'vet-change-role-dialog',
  imports: [VetModal, RolePicker],
  template: `
    <vet-modal [title]="'Cambiar rol de ' + member.name" subtitle="El cambio aplica en máximo 15 minutos.">
      <vet-role-picker [value]="role()" (valueChange)="role.set($event)" label="Rol" />
      <ng-container footer>
        <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
        <button type="button" class="btn" [disabled]="role() === member.role" (click)="ref.close(role())">Guardar rol</button>
      </ng-container>
    </vet-modal>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn:disabled { border-color: #d9d7ea; background: #f0f0f3; color: #8a8a9a; cursor: not-allowed; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeRoleDialog {
  protected readonly member = inject<Member>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ChangeRoleDialog, MemberRole>>(MatDialogRef);
  protected readonly role = signal<MemberRole>(this.member.role === 'OWNER' ? 'ADMIN' : this.member.role);
}
