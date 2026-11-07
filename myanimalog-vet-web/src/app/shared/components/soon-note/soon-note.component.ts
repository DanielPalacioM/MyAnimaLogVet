import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FEATURE_MESSAGE, FEATURES, FeatureName } from '@services/features';

/** Aviso suave cuando una función todavía no está conectada al backend (se apaga solo al activarla en el entorno). */
@Component({
  selector: 'vet-soon-note',
  template: `
    @if (!enabled()) {
      <p role="status"><strong>Disponible pronto.</strong> {{ message() }}</p>
    }
  `,
  styles: `
    p { margin: 0; padding: 10px 14px; border-radius: 8px; background: #f7f6ff; color: #4a4860; font: 500 13px/1.4 'Afacad', sans-serif; }
    strong { color: #4037be; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoonNote {
  readonly feature = input.required<FeatureName>();
  protected readonly enabled = computed(() => FEATURES[this.feature()]);
  protected readonly message = computed(() => FEATURE_MESSAGE[this.feature()]);
}
