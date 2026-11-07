import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '@services/api-error';
import { AdminApi, RejectReason, SubjectType } from '@services/api/admin.api';
import { REJECT_REASONS } from '../admin.format';
import { ADMIN_DIALOG_STYLES } from './dialog.styles';

export interface RejectData {
  requestId: string;
  subjectType: SubjectType;
  name: string;
  /** Número del intento que se está revisando (1 a 3). */
  attempt: number;
}

const MAX_NOTE = 1000;
const MAX_ATTEMPTS = 3;

/** "Rechazar a …" (Figma 2192:483): motivo y nota obligatoria. Quedan 3 intentos en total. */
@Component({
  selector: 'vet-reject-dialog',
  template: `
    <h2>Rechazar a {{ data.name }}</h2>
    <p class="lead">Le enviaremos un correo con el motivo. Podrá enviar una solicitud nueva con documentos nuevos; {{ attemptsText }}.</p>

    <p class="label">Motivo</p>
    <div class="options" role="radiogroup" aria-label="Motivo del rechazo">
      @for (r of reasons; track r.value) {
        <label class="opt">
          <input type="radio" name="reason" [checked]="reason() === r.value" (change)="reason.set(r.value)" />
          <span class="radio" aria-hidden="true"></span>
          <span class="txt">{{ r.label }}</span>
        </label>
      }
    </div>

    <p class="label">Nota para {{ audience }} (obligatoria)</p>
    <textarea [value]="note()" (input)="note.set($any($event.target).value)" [maxLength]="max" aria-label="Nota para el solicitante"></textarea>

    <p class="warn">Los documentos de una solicitud rechazada se borran a los 90 días. Esta acción no se puede deshacer.</p>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div class="actions">
      <button type="button" class="btn btn--ghost" (click)="ref.close(false)">Cancelar</button>
      <button type="button" class="btn btn--danger" [disabled]="!valid() || sending()" (click)="send()">{{ sending() ? 'Rechazando…' : 'Rechazar solicitud' }}</button>
    </div>
  `,
  styles: ADMIN_DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RejectDialog {
  protected readonly data = inject<RejectData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<RejectDialog, boolean>>(MatDialogRef);
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);

  protected readonly max = MAX_NOTE;
  protected readonly reasons = REJECT_REASONS[this.data.subjectType];
  protected readonly audience = this.data.subjectType === 'CLINIC' ? 'la clínica' : 'el veterinario';
  protected readonly reason = signal<RejectReason>(this.reasons[0].value);
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly valid = computed(() => this.note().trim().length > 0);

  protected get attemptsText(): string {
    const left = Math.max(0, MAX_ATTEMPTS - this.data.attempt);
    return left === 0 ? 'ya no le quedarían intentos: solo podrá escribir a soporte' : `le quedarían ${left} de ${MAX_ATTEMPTS} intentos`;
  }

  protected send(): void {
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.api.reject(this.data.requestId, this.reason(), this.note().trim()).subscribe({
      next: () => {
        this.snack.open('Solicitud rechazada. Le avisamos por correo.', 'Cerrar', { duration: 3500 });
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.sending.set(false);
      },
    });
  }
}
