import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, viewChildren } from '@angular/core';

/** Presentacional: código numérico de N dígitos (una caja por dígito). Soporta pegar el código completo. */
@Component({
  selector: 'vet-otp-input',
  template: `
    <div class="boxes" role="group" [attr.aria-label]="ariaLabel()">
      @for (i of indexes(); track i) {
        <input
          #box
          class="box"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="1"
          [attr.aria-label]="'Dígito ' + (i + 1)"
          [value]="digitAt(i)"
          [attr.aria-invalid]="invalid()"
          (input)="onInput($event, i)"
          (keydown)="onKey($event, i)"
          (paste)="onPaste($event)"
          (focus)="select($event)"
        />
      }
    </div>
  `,
  styles: `
    .boxes { display: flex; justify-content: space-between; gap: 8px; }
    .box {
      width: 41px; height: 44px; box-sizing: border-box; border: 2px solid #000; border-radius: 5px;
      background: #fff; text-align: center; font: 700 20px/1 'Afacad', sans-serif; color: var(--vet-text);
    }
    .box:focus-visible { outline: 2px solid var(--vet-primary); outline-offset: 1px; }
    .box[aria-invalid='true'] { border-color: var(--vet-danger); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpInput {
  readonly length = input(6);
  readonly ariaLabel = input('Código de verificación');
  readonly invalid = input(false);
  /** Código escrito hasta ahora (solo dígitos). */
  readonly value = model('');

  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');
  protected readonly indexes = computed(() => Array.from({ length: this.length() }, (_, i) => i));
  protected readonly digits = computed(() => this.value().split(''));

  protected digitAt(index: number): string {
    return this.value()[index] ?? '';
  }

  protected onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.replace(/\D/g, '');
    if (!typed) {
      this.setDigit(index, '');
      input.value = '';
      return;
    }
    // Si el navegador autocompleta varios dígitos en una caja, repartirlos.
    this.fill(index, typed);
  }

  protected onKey(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      event.preventDefault();
      this.setDigit(index - 1, '');
      this.focus(index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focus(index - 1);
    } else if (event.key === 'ArrowRight' && index < this.length() - 1) {
      this.focus(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (pasted) this.fill(0, pasted);
  }

  protected select(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  private fill(start: number, typed: string): void {
    const chars = this.value().padEnd(this.length(), ' ').split('');
    let i = start;
    for (const d of typed) {
      if (i >= this.length()) break;
      chars[i++] = d;
    }
    this.value.set(chars.join('').replace(/ /g, ''));
    this.focus(Math.min(i, this.length() - 1));
  }

  private setDigit(index: number, digit: string): void {
    const chars = this.value().padEnd(this.length(), ' ').split('');
    chars[index] = digit || ' ';
    // Conserva posiciones: un hueco intermedio se vuelve espacio y se recorta al final.
    this.value.set(chars.join('').trimEnd().replace(/ /g, ''));
  }

  private focus(index: number): void {
    this.boxes()[index]?.nativeElement.focus();
  }
}
