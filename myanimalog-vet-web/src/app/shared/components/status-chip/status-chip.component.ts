import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AppointmentStatus, STATUS_COLOR, STATUS_LABEL } from '@services/clinic/clinic.models';

/** Chip de estado de una cita (DISENO §4). El estado va siempre con texto, no solo con color. */
@Component({
  selector: 'vet-status-chip',
  template: `<span class="chip" [style.color]="c().fg" [style.background]="c().bg">{{ label() }}</span>`,
  styles: `.chip { display: inline-block; padding: 4px 10px; border-radius: 12px; font: 700 12px/1.25 'Afacad', sans-serif; white-space: nowrap; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChip {
  readonly status = input.required<AppointmentStatus>();
  protected readonly c = computed(() => STATUS_COLOR[this.status()]);
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
