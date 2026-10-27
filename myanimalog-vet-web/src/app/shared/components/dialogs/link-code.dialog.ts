import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { ClinicStore } from '@services/clinic/clinic.store';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VetModal } from '../modal/modal.component';
import { VetQr } from '../qr/qr.component';
import { downloadQr } from '../qr/download-qr';

/** "Mostrar código QR": el que se enseña en recepción para vincular dueños. */
@Component({
  selector: 'vet-link-code-dialog',
  imports: [VetModal, VetQr, RouterLink],
  template: `
    <vet-modal title="Código QR de la clínica" subtitle="Muéstralo en recepción: el dueño lo escanea desde MyAnimaLog y elige qué mascotas compartir.">
      @if (store.linkCode(); as code) {
        <div class="qr">
          <vet-qr [value]="code" />
          <strong>{{ code }}</strong>
        </div>
      } @else {
        <p class="none">No hay un código activo. Genera uno nuevo en Mi clínica.</p>
      }
      <ng-container footer>
        @if (store.linkCode(); as code) {
          <button type="button" class="btn" (click)="download(code)">Descargar QR</button>
          <button type="button" class="btn btn--ghost" (click)="copy(code)">Copiar código</button>
        } @else {
          <a class="btn" routerLink="/mi-clinica" (click)="ref.close()">Ir a Mi clínica</a>
        }
      </ng-container>
    </vet-modal>
  `,
  styles: `
    :host { display: block; width: min(520px, 92vw); }
    .qr { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 8px 0; }
    .qr strong { font: 700 24px/1.3 'Afacad', sans-serif; letter-spacing: 0.04em; }
    .none { margin: 0; color: #404040; font: 500 14px/1.4 'Afacad', sans-serif; }
    .btn { display: grid; place-items: center; height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; text-decoration: none; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkCodeDialog {
  protected readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<LinkCodeDialog>>(MatDialogRef);
  private readonly snack = inject(MatSnackBar);

  protected download(code: string): void {
    downloadQr(code);
    this.snack.open('QR descargado', 'Cerrar', { duration: 3000 });
  }

  protected copy(code: string): void {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    this.snack.open(`Código ${code} copiado`, 'Cerrar', { duration: 3000 });
  }
}
