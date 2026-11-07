import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { interval } from 'rxjs';
import { errorMessage } from '@services/api-error';
import { AdminApi, VerificationDocument } from '@services/api/admin.api';
import { DOCUMENT_LABELS } from '../admin.format';

export interface CompareRow {
  label: string;
  value: string;
}

export interface ViewerData {
  requestId: string;
  /** Nombre de la clínica o del profesional. */
  name: string;
  documents: VerificationDocument[];
  index: number;
  /** "Datos a comparar" de cada tipo de documento (lo que declaró el solicitante). */
  compare: Record<string, CompareRow[]>;
}

const ZOOM_STEP = 25;

/**
 * Visor de documento (Figma 2192:666): el archivo se abre dentro de la pantalla con un enlace firmado que
 * vence a los 10 minutos, junto a los datos declarados para compararlos a ojo.
 */
@Component({
  selector: 'vet-document-viewer-dialog',
  template: `
    <header>
      <div class="title">
        <h2>{{ label() }} · {{ data.name }}</h2>
        <p>{{ doc().fileName }}{{ size() ? ' · ' + size() : '' }}</p>
      </div>
      <span class="chip" [class.chip--bad]="expired()">{{ expired() ? 'Enlace vencido' : 'Enlace seguro · vence en ' + remaining() }}</span>
      <button #closeBtn type="button" class="x" (click)="ref.close()" aria-label="Cerrar">✕</button>
    </header>

    <div class="body">
      <section class="preview" aria-label="Vista del documento">
        @if (isImage()) {
          <div class="tools"><span class="zoom">
            <button type="button" (click)="zoomBy(-1)" aria-label="Alejar">−</button>
            {{ zoom() }} %
            <button type="button" (click)="zoomBy(1)" aria-label="Acercar">+</button>
          </span></div>
        }
        <div class="sheet" [class.sheet--img]="isImage()">
          @if (expired()) {
            <div class="expired">
              <p>El enlace de este documento venció.</p>
              <button type="button" class="btn" (click)="renew()" [disabled]="renewing()">{{ renewing() ? 'Pidiendo…' : 'Pedir un enlace nuevo' }}</button>
            </div>
          } @else if (isImage()) {
            <img [src]="url()" [alt]="label()" [style.width.%]="zoom()" />
          } @else {
            <iframe [src]="frame()" [title]="label()" (load)="keepFocus(closeBtn)"></iframe>
          }
        </div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      </section>

      <aside class="compare" aria-label="Datos a comparar">
        <p class="label">Datos a comparar</p>
        @for (row of rows(); track row.label) {
          <div class="datum">
            <small>{{ row.label }}</small>
            <strong>{{ row.value }}</strong>
          </div>
        } @empty {
          <p class="none">Este documento no tiene datos para comparar. Revísalo a ojo.</p>
        }
        <p class="aside-note">Confirma los datos en el registro oficial antes de aprobar.</p>
      </aside>
    </div>

    <footer>
      <p>Documento {{ index() + 1 }} de {{ data.documents.length }} · Nadie más puede abrir este enlace y no se guarda en el servicio de IA.</p>
      <button type="button" class="btn btn--ghost" [disabled]="index() === 0" (click)="go(-1)">Anterior</button>
      @if (hasNext()) {
        <button type="button" class="btn" (click)="go(1)">Siguiente: {{ nextLabel() }}</button>
      } @else {
        <button type="button" class="btn" (click)="ref.close()">Cerrar</button>
      }
    </footer>
  `,
  styles: `
    :host { display: flex; flex-direction: column; box-sizing: border-box; width: min(960px, 96vw); font-family: 'Afacad', sans-serif; color: #1a1a2e; }
    header { display: flex; align-items: center; gap: 12px; padding: 18px 24px 18px 28px; border-bottom: 1px solid #e6e4f5; }
    .title { flex: 1; min-width: 0; }
    h2 { margin: 0; overflow: hidden; font: 700 18px/1.3 'Afacad', sans-serif; text-overflow: ellipsis; white-space: nowrap; }
    .title p { margin: 2px 0 0; color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    .chip { padding: 3px 8px; border-radius: 10px; background: #f1f0fb; color: #4037be; font: 700 11px/1.3 'Afacad', sans-serif; white-space: nowrap; }
    .chip--bad { background: #fef3f2; color: #b42318; }
    .x { padding: 0 4px; border: 0; background: none; font: 700 18px/1 'Afacad', sans-serif; cursor: pointer; }
    .body { display: flex; min-height: 0; }
    .preview { display: flex; flex: none; flex-direction: column; align-items: center; gap: 14px; box-sizing: border-box; width: 620px; padding: 20px 24px 24px; background: #f0f0f3; }
    .tools { display: flex; justify-content: flex-end; width: 100%; }
    .zoom { display: flex; align-items: center; gap: 10px; color: #4a4860; font: 700 13px/1 'Afacad', sans-serif; }
    .zoom button { padding: 0 4px; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
    .sheet { box-sizing: border-box; width: 100%; height: 400px; overflow: hidden; border: 1.5px solid #e6e4f5; border-radius: 12px; background: #fff; }
    .sheet--img { overflow: auto; }
    iframe { width: 100%; height: 100%; border: 0; }
    img { display: block; max-width: none; margin: 0 auto; }
    .expired { display: grid; height: 100%; place-content: center; gap: 12px; text-align: center; color: #4a4860; font: 500 14px/1.35 'Afacad', sans-serif; }
    .expired p { margin: 0; }
    .compare { display: flex; flex: 1; flex-direction: column; gap: 14px; padding: 20px 28px 24px 24px; }
    .label { margin: 0; color: #8a8a9a; font: 700 12px/1.3 'Afacad', sans-serif; text-transform: uppercase; }
    .datum { display: flex; flex-direction: column; gap: 2px; }
    .datum small { color: #8a8a9a; font: 700 11px/1.3 'Afacad', sans-serif; }
    .datum strong { font: 700 15px/1.3 'Afacad', sans-serif; overflow-wrap: anywhere; }
    .none, .aside-note { margin: 0; padding: 10px 12px; border-radius: 8px; background: #f7f6ff; color: #4a4860; font: 500 12px/1.35 'Afacad', sans-serif; }
    .error { margin: 0; color: #b42318; font: 700 13px/1.3 'Afacad', sans-serif; }
    footer { display: flex; align-items: center; gap: 10px; padding: 14px 24px 14px 28px; border-top: 1px solid #e6e4f5; }
    footer p { flex: 1; margin: 0; color: #8a8a9a; font: 500 12px/1.35 'Afacad', sans-serif; }
    .btn { padding: 10px 18px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 14px/1.2 'Afacad', sans-serif; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:disabled { opacity: 0.5; cursor: default; }
    .btn:focus-visible, .x:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
    @media (max-width: 900px) { .body { flex-direction: column; } .preview { width: auto; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewerDialog {
  protected readonly data = inject<ViewerData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<DocumentViewerDialog>>(MatDialogRef);
  private readonly api = inject(AdminApi);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly index = signal(this.data.index);
  /** Enlaces ya renovados (por documento), para no pedir otro si todavía sirve. */
  private readonly renewed = signal<Record<string, { url: string; expiresAt: string }>>({});
  private readonly now = signal(Date.now());
  protected readonly zoom = signal(100);
  protected readonly renewing = signal(false);
  protected readonly error = signal('');

  protected readonly doc = computed(() => this.data.documents[this.index()]);
  protected readonly label = computed(() => DOCUMENT_LABELS[this.doc().documentType] ?? this.doc().documentType);
  protected readonly url = computed(() => this.renewed()[this.doc().documentId]?.url ?? this.doc().signedUrl);
  private readonly expiresAt = computed(() => new Date(this.renewed()[this.doc().documentId]?.expiresAt ?? this.doc().signedUrlExpiresAt).getTime());
  protected readonly expired = computed(() => this.expiresAt() - this.now() <= 0);
  protected readonly remaining = computed(() => {
    const s = Math.max(0, Math.floor((this.expiresAt() - this.now()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  protected readonly isImage = computed(() => this.doc().mimeType.startsWith('image/'));
  protected readonly frame = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.url()));
  protected readonly rows = computed(() => this.data.compare[this.doc().documentType] ?? []);
  protected readonly hasNext = computed(() => this.index() < this.data.documents.length - 1);
  protected readonly nextLabel = computed(() => {
    const next = this.data.documents[this.index() + 1];
    return next ? (DOCUMENT_LABELS[next.documentType] ?? next.documentType).replace(' (opcional)', '') : '';
  });
  protected readonly size = computed(() => {
    const bytes = this.doc().fileSizeBytes;
    if (!bytes) return '';
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.now.set(Date.now()));
  }

  /** El visor de PDF del navegador toma el foco al cargar y se traga Escape: se lo devolvemos al diálogo. */
  protected keepFocus(el: HTMLElement): void {
    for (const ms of [0, 400, 1500]) setTimeout(() => el.focus(), ms);
  }

  protected go(step: number): void {
    this.index.update((i) => Math.min(this.data.documents.length - 1, Math.max(0, i + step)));
    this.zoom.set(100);
    this.error.set('');
  }

  protected zoomBy(direction: number): void {
    this.zoom.update((z) => Math.min(300, Math.max(50, z + direction * ZOOM_STEP)));
  }

  protected renew(): void {
    this.renewing.set(true);
    this.error.set('');
    const { documentId } = this.doc();
    this.api.renewSignedUrl(this.data.requestId, documentId).subscribe({
      next: (res) => {
        this.renewed.update((r) => ({ ...r, [documentId]: { url: res.signedUrl, expiresAt: res.expiresAt } }));
        this.renewing.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.renewing.set(false);
      },
    });
  }
}
