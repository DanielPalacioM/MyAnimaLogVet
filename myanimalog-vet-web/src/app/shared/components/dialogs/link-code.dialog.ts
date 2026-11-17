import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { environment } from '@env/environment';
import { ClinicStore } from '@services/clinic/clinic.store';
import { inviteMessage, inviteUrl, mailtoUrl, whatsappUrl } from '@services/clinic/invite-link';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VetModal } from '../modal/modal.component';
import { VetQr } from '../qr/qr.component';
import { downloadQr } from '../qr/download-qr';

/** "Mostrar código QR": el que se enseña en recepción o se le manda al dueño para vincularlo. */
@Component({
  selector: 'vet-link-code-dialog',
  imports: [VetModal, VetQr, RouterLink],
  template: `
    <vet-modal title="Código QR de la clínica" subtitle="Muéstralo en recepción o envíaselo al dueño: lo escribe o lo escanea en MyAnimaLog y elige qué mascotas compartir.">
      @if (store.linkCode(); as code) {
        <div class="qr">
          <vet-qr [value]="code" />
          <strong>{{ code }}</strong>
        </div>
        <div class="send" role="group" aria-label="Enviar el código al dueño">
          <p>¿El dueño no está en la clínica? Envíale el enlace: al abrirlo, MyAnimaLog lo lleva a vincularse con el código ya escrito (si no tiene cuenta, la crea primero).</p>
          <div class="send-row">
            <button type="button" class="btn btn--ghost" (click)="whatsapp(code)">Enviar por WhatsApp</button>
            <button type="button" class="btn btn--ghost" (click)="email(code)">Enviar por correo</button>
            <button type="button" class="btn btn--ghost" (click)="copyLink(code)">Copiar enlace</button>
          </div>
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
    .send { margin-top: 8px; padding-top: 14px; border-top: 1px solid #ececf3; }
    .send p { margin: 0 0 10px; color: #404040; font: 500 13px/1.4 'Afacad', sans-serif; }
    .send-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .none { margin: 0; color: #404040; font: 500 14px/1.4 'Afacad', sans-serif; }
    .btn { display: grid; place-items: center; height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; text-decoration: none; cursor: pointer; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    .send .btn { font-size: 14px; padding: 0 6px; }
    .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
    @media (max-width: 480px) { .send-row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkCodeDialog {
  protected readonly store = inject(ClinicStore);
  protected readonly ref = inject<MatDialogRef<LinkCodeDialog>>(MatDialogRef);
  private readonly snack = inject(MatSnackBar);

  private readonly clinicName = computed(() => this.store.profile()?.name ?? 'tu clínica');

  protected download(code: string): void {
    downloadQr(code);
    this.snack.open('QR descargado', 'Cerrar', { duration: 3000 });
  }

  protected copy(code: string): void {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    this.snack.open(`Código ${code} copiado`, 'Cerrar', { duration: 3000 });
  }

  private message(code: string): string {
    return inviteMessage(this.clinicName(), code, inviteUrl(environment.ownerAppUrl, code));
  }

  protected whatsapp(code: string): void {
    window.open(whatsappUrl(this.message(code)), '_blank', 'noopener');
  }

  protected email(code: string): void {
    window.open(mailtoUrl(`Vincúlate a ${this.clinicName()} en MyAnimaLog`, this.message(code)), '_self');
  }

  protected copyLink(code: string): void {
    void navigator.clipboard?.writeText(inviteUrl(environment.ownerAppUrl, code)).catch(() => undefined);
    this.snack.open('Enlace copiado', 'Cerrar', { duration: 3000 });
  }
}
