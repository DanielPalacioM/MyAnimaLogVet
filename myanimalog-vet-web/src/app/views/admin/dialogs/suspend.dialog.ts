import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '@services/api-error';
import { AdminApi } from '@services/api/admin.api';
import { ADMIN_DIALOG_STYLES } from './dialog.styles';

export interface SuspendData {
  id: string;
  name: string;
}

const MIN_REASON = 10;
const MAX_REASON = 500;

/** Suspender una clínica: el motivo (10 a 500 caracteres) lo ve el dueño en su panel y le llega por correo. */
@Component({
  selector: 'vet-suspend-dialog',
  template: `
    <h2>Suspender {{ data.name }}</h2>
    <p class="lead">Avisaremos al dueño por correo. Mientras esté suspendida, la clínica ve su información pero no puede agendar, registrar pacientes ni escribir en historias.</p>

    <p class="label">Motivo (obligatorio)</p>
    <textarea [value]="reason()" (input)="reason.set($any($event.target).value)" [maxLength]="max" aria-label="Motivo de la suspensión"></textarea>
    <p class="count">{{ reason().trim().length }} / {{ max }} · mínimo {{ min }} caracteres</p>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div class="actions">
      <button type="button" class="btn btn--ghost" (click)="ref.close(false)">Cancelar</button>
      <button type="button" class="btn btn--danger" [disabled]="!valid() || sending()" (click)="send()">{{ sending() ? 'Suspendiendo…' : 'Suspender clínica' }}</button>
    </div>
  `,
  styles: ADMIN_DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuspendDialog {
  protected readonly data = inject<SuspendData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<SuspendDialog, boolean>>(MatDialogRef);
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);

  protected readonly min = MIN_REASON;
  protected readonly max = MAX_REASON;
  protected readonly reason = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly valid = computed(() => this.reason().trim().length >= MIN_REASON);

  protected send(): void {
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.api.suspend(this.data.id, this.reason().trim()).subscribe({
      next: () => {
        this.snack.open('Clínica suspendida.', 'Cerrar', { duration: 3500 });
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.sending.set(false);
      },
    });
  }
}
