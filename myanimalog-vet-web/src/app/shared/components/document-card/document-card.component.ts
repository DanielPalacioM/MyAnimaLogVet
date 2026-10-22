import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DOCUMENT_RULE, FileRule, formatSize, validateFile } from '@shared/validators/files';

export type DocumentState = 'pending' | 'ready' | 'correct';

let nextId = 0;

/**
 * Presentacional (Vet/Documento, Figma 1908:48): tarjeta con estado Pendiente, Listo o Corregir.
 * Valida el archivo elegido (tipo y peso) y emite `picked` solo si es válido.
 */
@Component({
  selector: 'vet-document-card',
  imports: [MatIconModule],
  template: `
    <div class="card" [class.card--correct]="state() === 'correct'">
      <span class="icon" [class.icon--ready]="state() === 'ready'" aria-hidden="true">
        <mat-icon fontSet="material-icons-outlined">description</mat-icon>
      </span>

      <div class="text">
        <p class="title" [id]="id + '-title'">{{ title() }}</p>
        <p class="hint">
          @if (fileName(); as name) {
            {{ name }}@if (fileSize() !== null) { · {{ size() }} }
          } @else {
            {{ hint() }}
          }
        </p>
      </div>

      @if (state() === 'ready') {
        <span class="chip"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">check</mat-icon>Listo</span>
      }
      @if (!locked()) {
        <button
          type="button"
          class="action"
          [class.action--correct]="state() === 'correct'"
          [class.action--icon]="state() === 'ready'"
          [attr.title]="state() === 'ready' ? 'Reemplazar archivo' : null"
          [attr.aria-describedby]="id + '-title'"
          (click)="input.click()"
        >
          @if (state() === 'pending') {
            <mat-icon fontSet="material-icons-outlined" aria-hidden="true">upload</mat-icon>Subir
          } @else if (state() === 'correct') {
            Volver a subir
          } @else {
            <mat-icon fontSet="material-icons-outlined" aria-hidden="true">sync</mat-icon>
            <span class="vet-sr-only">Reemplazar</span>
          }
        </button>
      }
      <input
        #input
        class="vet-sr-only"
        type="file"
        tabindex="-1"
        [accept]="accept()"
        [attr.aria-labelledby]="id + '-title'"
        (change)="onChange($event)"
      />
    </div>
    @if (error(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }
  `,
  styleUrl: './document-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentCard {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly state = input<DocumentState>('pending');
  readonly fileName = input<string | null>(null);
  readonly fileSize = input<number | null>(null);
  readonly rule = input<FileRule>(DOCUMENT_RULE);
  /** Sin botón de acción (documento reutilizado de otro paso). */
  readonly locked = input(false);

  readonly picked = output<File>();

  protected readonly id = `vet-doc-${nextId++}`;
  protected readonly error = signal<string | null>(null);
  protected readonly accept = computed(() => this.rule().extensions.map((e) => `.${e}`).join(','));
  protected readonly size = computed(() => formatSize(this.fileSize() ?? 0));

  protected onChange(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    element.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    const problem = validateFile(file, this.rule());
    this.error.set(problem);
    if (!problem) this.picked.emit(file);
  }
}
