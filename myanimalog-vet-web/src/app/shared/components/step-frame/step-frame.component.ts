import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { TOTAL_STEPS } from '@services/register/models/registration.model';

/**
 * Presentacional: estructura común de cada pantalla del registro (DISENO §6).
 * Indicador "PASO N DE 6" + barra, título, subtítulo, contenido y botones al pie (`[footer]`).
 * Al abrirse mueve el foco al título para que lectores de pantalla anuncien el paso.
 */
@Component({
  selector: 'vet-step-frame',
  template: `
    <section class="frame" [class.frame--tall]="tall()" [class.frame--plain]="!step()">
      @if (step(); as n) {
        <header class="progress">
          <p class="eyebrow">PASO {{ n }} DE {{ total }}&nbsp;&nbsp;·&nbsp;&nbsp;{{ label() }}</p>
          <div
            class="bar"
            role="progressbar"
            aria-valuemin="0"
            [attr.aria-valuemax]="total"
            [attr.aria-valuenow]="n"
            [attr.aria-label]="'Paso ' + n + ' de ' + total"
          >
            <span [style.width.%]="(n / total) * 100"></span>
          </div>
        </header>
      }

      <h1 #heading tabindex="-1" [style.font-size.px]="titleSize()">{{ title() }}</h1>
      @if (subtitle(); as text) {
        <p class="subtitle" [class.subtitle--left]="subtitleLeft()" [style.font-size.px]="subtitleSize()" [style.line-height.px]="subtitleSize() > 15 ? 19 : 19">{{ text }}</p>
      }

      <div class="body" [style.margin-top.px]="bodyTop()">
        <ng-content />
      </div>

      <div class="footer">
        <ng-content select="[footer]" />
      </div>
    </section>
  `,
  styleUrl: './step-frame.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepFrame {
  /** 1–6; si falta, no se dibuja el indicador (pantallas previas y de estado). */
  readonly step = input<number | null>(null);
  readonly label = input('');
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly subtitleLeft = input(false);
  /** Separación entre el subtítulo y el contenido (34 px por defecto; el Figma la ajusta por pantalla). */
  readonly bodyTop = input<number | null>(null);
  /** Medium 15 en casi todos los pasos; 20 en "Crea tu cuenta" (Figma 1899:73). */
  readonly subtitleSize = input(15);
  /** Título de pantalla (el Figma usa 64 y baja a 40; aquí 44 para un aire más minimalista). */
  readonly titleSize = input(64);
  /** Variante con más aire arriba (paso 1 y verificación). */
  readonly tall = input(false);

  protected readonly total = TOTAL_STEPS;
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus({ preventScroll: true }));
  }
}
