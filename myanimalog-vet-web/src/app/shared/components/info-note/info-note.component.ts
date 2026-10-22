import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Presentacional: nota informativa sobre fondo morado suave (Figma: "Estos datos deben coincidir…"). */
@Component({
  selector: 'vet-info-note',
  imports: [MatIconModule],
  template: `
    <div class="note" role="note">
      <mat-icon fontSet="material-icons-outlined" aria-hidden="true">{{ icon() }}</mat-icon>
      <p><ng-content /></p>
    </div>
  `,
  styles: `
    .note { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 5px; background: var(--vet-soft); }
    mat-icon { flex: none; width: 16px; height: 16px; font-size: 16px; color: var(--vet-primary); }
    p { margin: 0; font: 500 12px/1.4 'Afacad', sans-serif; color: var(--vet-text-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoNote {
  readonly icon = input('info');
}
