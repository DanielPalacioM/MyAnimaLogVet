import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'home' | 'cal' | 'paw' | 'users' | 'chart' | 'badge' | 'clock' | 'clinic' | 'card' | 'shield'
  | 'search' | 'bell' | 'plus' | 'arrow' | 'qr' | 'userplus' | 'left' | 'right' | 'scissors' | 'x' | 'tag' | 'phone' | 'note' | 'check';

/**
 * Ícono del diseño (Figma `icon/*`, exportados a `public/brand/icons`). Se pinta con `currentColor`,
 * así toma el color del texto donde se use.
 */
@Component({
  selector: 'vet-icon',
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.-webkit-mask-image]': 'url()',
    '[style.mask-image]': 'url()',
  },
  styles: `
    :host {
      display: inline-block;
      flex: none;
      background: currentColor;
      -webkit-mask-position: center;
      mask-position: center;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-size: contain;
      mask-size: contain;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VetIcon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  protected url(): string {
    return `url(/brand/icons/${this.name()}.svg)`;
  }
}
