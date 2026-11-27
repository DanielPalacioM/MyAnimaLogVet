import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { errorMessage } from '@services/api-error';
import { DOCUMENT_TYPES, MedicalApi, Visit } from '@services/api/medical.api';
import { VetField } from '@shared/components/form-field/form-field.component';
import { VetModal } from '@shared/components/modal/modal.component';

export interface DocumentDialogData {
  petId: string;
  visits: Visit[];
  /** Consulta preseleccionada (p. ej. desde una cirugía). */
  visitId?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];

/** "Subir documento" de la historia clínica (Medical V8, `POST /documents`). Solo la clínica lo sube y lo ve. */
@Component({
  selector: 'vet-document-dialog',
  imports: [ReactiveFormsModule, VetModal, VetField],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <vet-modal title="Subir documento" subtitle="PDF, JPG o PNG de máximo 10 MB. Queda en la historia de la mascota.">
        <label class="drop" [class.drop--on]="file()" [class.drop--bad]="fileError()">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" (change)="pick($event)" />
          @if (file(); as f) {
            <strong>{{ f.name }}</strong><small>{{ size(f.size) }} · toca para cambiarlo</small>
          } @else {
            <strong>Elige un archivo</strong><small>PDF, JPG o PNG · máximo 10 MB</small>
          }
        </label>
        @if (fileError()) { <p class="error" role="alert">{{ fileError() }}</p> }

        <div class="row">
          <vet-field label="Tipo" for="dc-type" [control]="form.controls.documentType">
            <select id="dc-type" class="vet-input" formControlName="documentType">
              @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
            </select>
          </vet-field>
          <vet-field label="Consulta (opcional)" for="dc-visit" [control]="form.controls.visitId">
            <select id="dc-visit" class="vet-input" formControlName="visitId">
              <option value="">Sin consulta</option>
              @for (v of data.visits; track v.id) { <option [value]="v.id">{{ visitLabel(v) }}</option> }
            </select>
          </vet-field>
        </div>
        <vet-field label="Título" for="dc-title" [control]="form.controls.title">
          <input id="dc-title" class="vet-input" formControlName="title" placeholder="Ej. Resultado de química sanguínea" autocomplete="off" />
        </vet-field>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        <ng-container footer>
          <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
          <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Subiendo…' : 'Subir documento' }}</button>
        </ng-container>
      </vet-modal>
    </form>
  `,
  styles: `
    :host { display: block; width: min(560px, 92vw); }
    .drop { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 22px 16px; border: 2px dashed #c9c6ec; border-radius: 10px; background: #faf9ff; text-align: center; cursor: pointer; }
    .drop:focus-within { outline: 2px solid #4037be; outline-offset: 2px; }
    .drop--on { border-style: solid; border-color: #4037be; }
    .drop--bad { border-color: #b42318; background: #fef3f2; }
    .drop input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .drop strong { font: 700 14px/1.3 'Afacad', sans-serif; word-break: break-all; }
    .drop small { color: #4a4860; font: 500 12px/1.3 'Afacad', sans-serif; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .error { margin: 0; color: #b42318; font: 700 12px/1.3 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn:disabled { opacity: 0.6; cursor: default; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
    @media (max-width: 520px) { .row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class DocumentDialog {
  protected readonly data = inject<DocumentDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<DocumentDialog, boolean>>(MatDialogRef);
  private readonly api = inject(MedicalApi);
  protected readonly types = DOCUMENT_TYPES;
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    documentType: ['LABORATORIO', [Validators.required]],
    visitId: [this.data.visitId ?? ''],
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
  });

  protected pick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set('');
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      this.fileError.set('Solo PDF, JPG o PNG.');
      return;
    }
    if (f.size > MAX_BYTES) {
      this.fileError.set('El archivo pasa de 10 MB.');
      return;
    }
    this.file.set(f);
    if (!this.form.controls.title.value) this.form.controls.title.setValue(f.name.replace(/\.[^.]+$/, '').slice(0, 150));
  }

  protected size(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  protected visitLabel(v: Visit): string {
    const d = new Date(v.date.length <= 10 ? `${v.date}T00:00:00` : v.date);
    const day = Number.isNaN(d.getTime()) ? v.date : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${day} · ${v.reason || 'Consulta'}`;
  }

  protected save(): void {
    this.form.markAllAsTouched();
    this.error.set('');
    const file = this.file();
    if (!file) {
      this.fileError.set('Elige un archivo.');
      return;
    }
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.api.uploadDocument({ petId: this.data.petId, file, documentType: v.documentType, title: v.title.trim(), visitId: v.visitId || undefined }).subscribe({
      next: () => this.ref.close(true),
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(errorMessage(e, 'No pudimos subir el documento. Inténtalo de nuevo.'));
      },
    });
  }
}
