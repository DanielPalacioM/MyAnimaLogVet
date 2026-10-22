import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
}

/** Presentacional: opciones excluyentes en tarjetas (p. ej. "Sí, soy yo" / "No, es otra persona"). */
@Component({
  selector: 'vet-choice-cards',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChoiceCards), multi: true }],
  template: `
    <div class="group" role="radiogroup" [attr.aria-label]="ariaLabel()">
      @for (opt of options(); track opt.value; let i = $index) {
        <button
          type="button"
          role="radio"
          class="choice"
          [class.selected]="value() === opt.value"
          [attr.aria-checked]="value() === opt.value"
          [attr.tabindex]="isTabStop(i) ? 0 : -1"
          [disabled]="disabled()"
          (click)="select(opt.value)"
          (keydown)="onKey($event, i)"
          (blur)="onTouched()"
        >
          <span class="dot" aria-hidden="true"></span>
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
    .choice {
      display: flex; align-items: center; gap: 10px; height: 41px; padding: 0 12px;
      border: 2px solid #000; border-radius: 5px; background: #fff; color: #000;
      font: 700 13px/1 'Afacad', sans-serif; text-align: left; cursor: pointer;
    }
    .choice:focus-visible { outline: 2px solid var(--vet-primary); outline-offset: 2px; }
    .choice:disabled { opacity: 0.5; cursor: not-allowed; }
    .dot {
      flex: none; width: 14px; height: 14px; box-sizing: border-box; border: 2px solid #000;
      border-radius: 50%; background: #fff;
    }
    .selected { border-color: var(--vet-primary); background: var(--vet-soft); color: var(--vet-primary); }
    .selected .dot { border-color: var(--vet-primary); background: radial-gradient(var(--vet-primary) 40%, #fff 45%); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceCards implements ControlValueAccessor {
  readonly options = input.required<readonly ChoiceOption[]>();
  readonly ariaLabel = input<string>();

  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value);
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected select(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }

  /** Solo una opción entra en el orden de tabulación (la elegida, o la primera). */
  protected isTabStop(index: number): boolean {
    const selected = this.options().findIndex((o) => o.value === this.value());
    return index === (selected === -1 ? 0 : selected);
  }

  protected onKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const options = this.options();
    const next = options[(index + step + options.length) % options.length];
    this.select(next.value);
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role=radio]')[options.indexOf(next)]?.focus();
  }
}
