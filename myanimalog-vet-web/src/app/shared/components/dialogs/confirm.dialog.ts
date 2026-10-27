import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VetModal } from '../modal/modal.component';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel: string;
  /** Acción que no se puede deshacer: el botón va en rojo. */
  danger?: boolean;
}

/** Confirmación con el marco de los modales del diseño. Cierra con `true` si el usuario confirma. */
@Component({
  selector: 'vet-confirm-dialog',
  imports: [VetModal],
  template: `
    <vet-modal [title]="data.title" [subtitle]="data.message">
      <ng-container footer>
        <button type="button" class="btn btn--ghost" (click)="ref.close(false)">Cancelar</button>
        <button type="button" class="btn" [class.btn--danger]="data.danger" (click)="ref.close(true)" cdkFocusInitial>{{ data.confirmLabel }}</button>
      </ng-container>
    </vet-modal>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn--danger { border-color: #b42318; background: #b42318; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ConfirmDialog, boolean>>(MatDialogRef);
}
