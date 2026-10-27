import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';
import { VetIcon } from '../icon/icon.component';

/**
 * Panel lateral de 400 px (Figma "Detalle de la cita" y "Ficha del paciente"): fondo atenuado,
 * encabezado con etiqueta y cerrar, contenido proyectado y acciones fijas abajo (`[footer]`).
 * Las clases `ss-*` del contenido se definen aquí para que ambas vistas se vean igual.
 */
@Component({
  selector: 'vet-side-sheet',
  imports: [VetIcon],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="ss-backdrop" (click)="closed.emit()"></div>
    <aside class="ss" role="dialog" [attr.aria-label]="label()">
      <header class="ss-head">
        <span>{{ label() }}</span>
        <button type="button" class="ss-x" (click)="closed.emit()" aria-label="Cerrar"><vet-icon name="x" [size]="20" /></button>
      </header>
      <ng-content />
      <div class="ss-footer"><ng-content select="[footer]" /></div>
    </aside>
  `,
  styles: `
    .ss-backdrop { position: fixed; inset: 0 0 0 232px; z-index: 20; background: rgb(26 26 46 / 6%); }
    .ss { position: fixed; top: 0; right: 0; bottom: 0; z-index: 21; box-sizing: border-box; display: flex; width: min(400px, 100vw); flex-direction: column; gap: 16px; overflow-y: auto; padding: 22px 24px; background: #fff; box-shadow: -8px 0 32px rgb(32 27 97 / 14%); color: #1a1a2e; font-family: 'Afacad', sans-serif; }
    .ss > * { flex-shrink: 0; }
    .ss-head { display: flex; align-items: center; justify-content: space-between; color: #8a8a9a; font: 700 12px/1.25 'Afacad', sans-serif; letter-spacing: 0.96px; text-transform: uppercase; }
    .ss-x { display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; background: none; color: #1a1a2e; cursor: pointer; }
    .ss-x:focus-visible, .ss-btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }

    .ss-hero { display: flex; align-items: center; gap: 14px; }
    .ss-hero-av { display: grid; flex: none; place-items: center; width: 56px; height: 56px; border-radius: 28px; background: #d9f5ef; }
    .ss-hero h2 { margin: 0; font: 700 28px/1.25 'Afacad', sans-serif; }
    .ss-hero p { margin: 2px 0 0; color: #4a4860; font: 500 13px/1.25 'Afacad', sans-serif; }
    .ss-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .ss-chip { padding: 4px 10px; border-radius: 12px; font: 700 12px/1.25 'Afacad', sans-serif; }

    .ss-row { display: flex; align-items: center; gap: 12px; }
    .ss-tile { display: grid; flex: none; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: #f1f0fb; color: #4037be; }
    .ss-row div { display: flex; min-width: 0; flex-direction: column; }
    .ss-row strong { font: 700 14px/1.25 'Afacad', sans-serif; }
    .ss-row small { color: #8a8a9a; font: 500 12px/1.25 'Afacad', sans-serif; }
    .ss-hr { flex: none; height: 1px; background: #e6e4f5; }

    .ss-owner { display: flex; align-items: center; gap: 10px; }
    .ss-owner > div { display: flex; flex: 1; flex-direction: column; gap: 1px; min-width: 0; }
    .ss-owner small { color: #8a8a9a; font: 700 11px/1.25 'Afacad', sans-serif; }
    .ss-owner strong { font: 700 15px/1.25 'Afacad', sans-serif; }
    .ss-phone { display: flex; align-items: center; gap: 5px; color: #4a4860; font: 500 13px/1.25 'Afacad', sans-serif; }
    .ss-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #000; border-radius: 5px; background: #fff; color: #1a1a2e; font: 700 13px/1.25 'Afacad', sans-serif; text-decoration: none; cursor: pointer; }
    .ss-share { display: flex; align-items: center; gap: 6px; color: #00796b; font: 500 12px/1.25 'Afacad', sans-serif; }
    .ss-note { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #f7f6ff; color: #4037be; }
    .ss-note div { display: flex; flex-direction: column; gap: 1px; }
    .ss-note b { font: 700 12px/1.25 'Afacad', sans-serif; }
    .ss-note span { color: #1a1a2e; font: 500 13px/1.25 'Afacad', sans-serif; }
    .ss-note--alert { background: #fff4e0; color: #b26a00; }

    .ss-hist-h { display: flex; align-items: center; justify-content: space-between; }
    .ss-hist-h h3 { margin: 0; font: 700 15px/1.25 'Afacad', sans-serif; }
    .ss-link { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: #4037be; font: 700 13px/1.25 'Afacad', sans-serif; cursor: pointer; }
    .ss-link:hover { text-decoration: underline; }
    .ss-hist { display: flex; align-items: center; gap: 12px; }
    .ss-hist time { width: 44px; color: #8a8a9a; font: 700 12px/1.25 'Afacad', sans-serif; }
    .ss-hist div { display: flex; flex-direction: column; }
    .ss-hist strong { font: 700 13px/1.25 'Afacad', sans-serif; }
    .ss-hist small { color: #8a8a9a; font: 500 12px/1.25 'Afacad', sans-serif; }

    .ss-tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 10px; font: 700 11px/1.35 'Afacad', sans-serif; }
    .ss-tag i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .ss-title { margin: 0; font: 700 15px/1.3 'Afacad', sans-serif; }
    .ss-contact { display: flex; align-items: center; gap: 12px; }
    .ss-contact > div { display: flex; flex: 1; flex-direction: column; gap: 6px; }
    .ss-contact span { display: flex; align-items: center; gap: 8px; font: 500 14px/1.35 'Afacad', sans-serif; }
    .ss-pets { display: flex; flex-direction: column; gap: 8px; }
    .ss-pet { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1.5px solid #e6e4f5; border-radius: 10px; background: #fff; text-align: left; cursor: pointer; font-family: 'Afacad', sans-serif; }
    .ss-pet:hover { background: #f7f6ff; }
    .ss-pet:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
    .ss-pet-av { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: 16px; background: #f1f0fb; color: #4037be; }
    .ss-pet-txt { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 1px; }
    .ss-pet-txt strong { font: 700 14px/1.3 'Afacad', sans-serif; }
    .ss-pet-txt small { color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    .ss-visit { display: flex; align-items: center; gap: 12px; }
    .ss-visit > div:first-child { display: flex; width: 72px; flex-direction: column; }
    .ss-visit > div:first-child b { font: 700 13px/1.3 'Afacad', sans-serif; }
    .ss-visit > div:first-child small { color: #8a8a9a; font: 500 11px/1.3 'Afacad', sans-serif; }
    .ss-visit > div:last-child { display: flex; flex-direction: column; gap: 1px; }
    .ss-visit strong { font: 700 13px/1.3 'Afacad', sans-serif; }
    .ss-visit small { color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    .ss-quit { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0; border: 0; background: none; cursor: pointer; font-family: 'Afacad', sans-serif; }
    .ss-quit strong { color: #b42318; font: 700 14px/1.3 'Afacad', sans-serif; }
    .ss-quit small { color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    .ss-quit:hover strong { text-decoration: underline; }
    .ss-quit:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
    .ss-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1.5px solid #e6e4f5; border-radius: 10px; }
    .ss-kv { display: flex; align-items: center; gap: 8px; font: 500 13px/1.3 'Afacad', sans-serif; }
    .ss-kv > span { width: 130px; flex: none; color: #8a8a9a; }
    .ss-kv > b { font: 700 13px/1.3 'Afacad', sans-serif; }
    .ss-perms { display: flex; flex-direction: column; gap: 6px; }
    .ss-perm { display: flex; align-items: center; gap: 8px; font: 500 13px/1.3 'Afacad', sans-serif; }
    .ss-perm--pending { color: #b26a00; }
    .ss-perm vet-icon { color: #00796b; }
    .ss-perm--pending i { flex: none; width: 8px; height: 8px; margin: 0 3px; box-sizing: border-box; border: 1.5px solid #b26a00; border-radius: 50%; }
    .ss-schedule { display: flex; align-items: center; gap: 10px; }
    .ss-schedule > div { display: flex; flex: 1; flex-direction: column; }
    .ss-schedule strong { font: 700 13px/1.3 'Afacad', sans-serif; }
    .ss-schedule small { color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
    .ss-alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; background: #fff4e0; color: #b26a00; }
    .ss-alert div { display: flex; flex-direction: column; gap: 2px; }
    .ss-alert b { font: 700 13px/1.3 'Afacad', sans-serif; }
    .ss-alert span { color: #404040; font: 500 12px/1.35 'Afacad', sans-serif; }

    .ss-footer { display: flex; flex: 1 0 auto; flex-direction: column; justify-content: flex-end; gap: 10px; }
    .ss-primary { display: flex; align-items: center; justify-content: center; gap: 8px; height: 44px; border: 0; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .ss-two { display: flex; gap: 10px; }
    .ss-two button { flex: 1; height: 41px; border: 2px solid #000; border-radius: 5px; background: #fff; color: #1a1a2e; font: 700 14px/1 'Afacad', sans-serif; cursor: pointer; }
    .ss-danger { padding: 4px; border: 0; background: none; color: #b42318; font: 700 14px/1.25 'Afacad', sans-serif; cursor: pointer; }
    .ss-danger:hover { text-decoration: underline; }
    .ss-hint { margin: 0; color: #8a8a9a; text-align: center; font: 500 12px/1.25 'Afacad', sans-serif; }
    .ss-primary:focus-visible, .ss-two button:focus-visible, .ss-danger:focus-visible, .ss-link:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
})
export class SideSheet {
  readonly label = input.required<string>();
  readonly closed = output<void>();
}
