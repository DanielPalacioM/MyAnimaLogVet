import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const DEFAULT_MESSAGES: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  email: 'Escribe un correo válido, por ejemplo tucorreo@clinica.com.',
};

/**
 * Presentacional (Vet/Campo): etiqueta arriba, control proyectado, ayuda o error debajo.
 * Muestra el error del `control` cuando el usuario ya lo tocó. Los validadores propios devuelven
 * `{ clave: { message } }` y el mensaje sale de ahí.
 */
@Component({
  selector: 'vet-field',
  template: `
    <div class="field" [class.field--lg]="large()">
      <label class="label" [class.label--lg]="large()" [attr.for]="for()">
        {{ label() }}@if (optional()) {<span class="optional"> (opcional)</span>}
      </label>
      <ng-content />
      @if (errorText(); as text) {
        <p class="msg msg--error" role="alert">{{ text }}</p>
      } @else if (hint()) {
        <p class="msg">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .field { display: flex; flex-direction: column; gap: 1px; }
        .label { font: 700 16px/21px 'Afacad', sans-serif; color: #000; }
    .label--lg { font-size: 20px; line-height: 26px; }
    .optional { font-weight: 500; color: var(--vet-text-2); }
    .msg { margin: 0; font: 500 12px/1.3 'Afacad', sans-serif; color: var(--vet-text-2); }
    .msg--error { color: var(--vet-danger); font-weight: 700; }
  `,
  // Default a propósito: el estado del control cambia sin que cambie ningún input de este componente.
  changeDetection: ChangeDetectionStrategy.Default,
})
export class VetField {
  readonly label = input.required<string>();
  /** id del control proyectado, para enlazar la etiqueta. */
  readonly for = input<string>();
  readonly control = input<AbstractControl | null>(null);
  readonly messages = input<Record<string, string>>({});
  readonly hint = input<string>();
  readonly optional = input(false);
  /** Etiqueta de 20 px (login). */
  readonly large = input(false);

  protected errorText(): string | null {
    const control = this.control();
    if (!control || !control.invalid || !(control.touched || control.dirty)) return null;
    const errors = control.errors ?? {};
    const key = Object.keys(errors)[0];
    if (!key) return null;
    const custom = (errors[key] as { message?: string } | true | undefined);
    return (
      this.messages()[key] ??
      (typeof custom === 'object' ? custom.message : undefined) ??
      DEFAULT_MESSAGES[key] ??
      'Revisa este campo.'
    );
  }
}
