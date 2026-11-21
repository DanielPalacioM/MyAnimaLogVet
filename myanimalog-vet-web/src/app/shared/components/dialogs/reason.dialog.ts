import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VetField } from '../form-field/form-field.component';
import { VetModal } from '../modal/modal.component';

export interface ReasonData {
  title: string;
  message: string;
  confirmLabel: string;
  /** El servidor exige motivo (rechazar). En cancelar es opcional. */
  required?: boolean;
}

/** Pide el motivo de rechazar o cancelar una cita (el dueño lo recibe en la notificación). Cierra con el texto. */
@Component({
  selector: 'vet-reason-dialog',
  imports: [ReactiveFormsModule, VetModal, VetField],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <vet-modal [title]="data.title" [subtitle]="data.message">
        <vet-field label="Motivo" for="rs-reason" [control]="form.controls.reason" [messages]="{ required: 'Cuéntale al dueño el motivo.' }">
          <textarea id="rs-reason" class="vet-input" rows="3" maxlength="300" formControlName="reason" placeholder="Ej. El veterinario no atiende ese día"></textarea>
        </vet-field>
        <ng-container footer>
          <button type="button" class="btn btn--ghost" (click)="ref.close()">Volver</button>
          <button type="submit" class="btn">{{ data.confirmLabel }}</button>
        </ng-container>
      </vet-modal>
    </form>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    textarea { height: auto; padding: 10px 12px; resize: vertical; font-family: inherit; }
    .btn { height: 41px; padding: 0 18px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReasonDialog {
  protected readonly data = inject<ReasonData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ReasonDialog, string>>(MatDialogRef);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    reason: ['', this.data.required ? [Validators.required, Validators.pattern(/\S/)] : []],
  });

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.ref.close(this.form.controls.reason.value.trim());
  }
}
