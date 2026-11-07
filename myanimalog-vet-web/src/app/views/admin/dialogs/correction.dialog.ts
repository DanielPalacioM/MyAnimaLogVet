import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '@services/api-error';
import { AdminApi, SubjectType } from '@services/api/admin.api';
import { CORRECTABLE, DOCUMENT_LABELS } from '../admin.format';
import { ADMIN_DIALOG_STYLES } from './dialog.styles';

export interface CorrectionData {
  requestId: string;
  subjectType: SubjectType;
  name: string;
}

const MAX_NOTE = 500;

/** "Pedir corrección a …" (Figma 2192:300): qué documentos cambiar y una nota obligatoria que ve el solicitante. */
@Component({
  selector: 'vet-correction-dialog',
  template: `
    <h2>Pedir corrección a {{ data.name }}</h2>
    <p class="lead">Le enviaremos un correo con tu nota y un enlace directo a cada documento marcado. Solo reemplaza esos; lo demás se queda como está.</p>

    <p class="label">¿Qué documentos debe corregir?</p>
    <div class="options" role="group" aria-label="Documentos a corregir">
      @for (type of types; track type) {
        <label class="opt">
          <input type="checkbox" [checked]="selected().has(type)" (change)="toggle(type)" />
          <span class="box" aria-hidden="true"></span>
          <span class="txt">{{ label(type) }}</span>
        </label>
      }
    </div>

    <p class="label">Nota para {{ audience }} (obligatoria)</p>
    <textarea [value]="note()" (input)="note.set($any($event.target).value)" [maxLength]="max" aria-label="Nota para el solicitante"></textarea>
    <p class="count">{{ note().length }} / {{ max }}</p>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div class="actions">
      <button type="button" class="btn btn--ghost" (click)="ref.close(false)">Cancelar</button>
      <button type="button" class="btn" [disabled]="!valid() || sending()" (click)="send()">{{ sending() ? 'Enviando…' : 'Enviar corrección' }}</button>
    </div>
  `,
  styles: ADMIN_DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrectionDialog {
  protected readonly data = inject<CorrectionData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<CorrectionDialog, boolean>>(MatDialogRef);
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);

  protected readonly max = MAX_NOTE;
  protected readonly types = CORRECTABLE[this.data.subjectType];
  protected readonly audience = this.data.subjectType === 'CLINIC' ? 'la clínica' : 'el veterinario';
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly valid = computed(() => this.selected().size > 0 && this.note().trim().length > 0);

  protected label(type: string): string {
    return DOCUMENT_LABELS[type] ?? type;
  }

  protected toggle(type: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(type)) next.add(type);
      return next;
    });
  }

  protected send(): void {
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.api.requestCorrection(this.data.requestId, [...this.selected()], this.note().trim()).subscribe({
      next: () => {
        this.snack.open('Corrección enviada. Le avisamos por correo.', 'Cerrar', { duration: 3500 });
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.sending.set(false);
      },
    });
  }
}
