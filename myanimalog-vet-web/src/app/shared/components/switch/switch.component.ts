import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Interruptor del diseño (Figma "Interruptor · Sí/No"): 34×20, encendido en morado. */
@Component({
  selector: 'vet-switch',
  template: `<span class="knob"></span>`,
  host: {
    role: 'switch',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-label]': 'label()',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[class.on]': 'checked()',
    '[class.disabled]': 'disabled()',
    '(click)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    '(keydown.enter)': 'toggle(); $event.preventDefault()',
  },
  styles: `
    :host { position: relative; display: inline-block; flex: none; width: 34px; height: 20px; border-radius: 10px; background: #d9d7ea; cursor: pointer; transition: background 0.15s; }
    :host(.on) { background: #4037be; }
    :host(.disabled) { cursor: not-allowed; opacity: 0.5; }
    :host(:focus-visible) { outline: 2px solid #4037be; outline-offset: 2px; }
    .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
    :host(.on) .knob { transform: translateX(14px); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VetSwitch {
  readonly checked = model(false);
  readonly label = input.required<string>();
  readonly disabled = input(false);

  protected toggle(): void {
    if (!this.disabled()) this.checked.update((v) => !v);
  }
}
