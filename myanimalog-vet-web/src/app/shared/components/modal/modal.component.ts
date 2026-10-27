import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { VetIcon } from '../icon/icon.component';

/** Marco de los modales del diseño: título de 30 px, subtítulo, cerrar y botones abajo (`[footer]`). */
@Component({
  selector: 'vet-modal',
  imports: [VetIcon],
  template: `
    <header>
      <div>
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <button type="button" class="x" (click)="close()" aria-label="Cerrar"><vet-icon name="x" [size]="20" /></button>
    </header>
    <ng-content />
    <div class="footer"><ng-content select="[footer]" /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; padding: 28px; font-family: 'Afacad', sans-serif; color: #1a1a2e; }
    header { display: flex; align-items: flex-start; gap: 12px; }
    header div { flex: 1; min-width: 0; }
    h2 { margin: 0; font: 700 30px/1.25 'Afacad', sans-serif; }
    p { margin: 4px 0 0; color: #404040; font: 500 14px/1.35 'Afacad', sans-serif; }
    .x { display: grid; place-items: center; padding: 0; border: 0; background: none; color: #1a1a2e; cursor: pointer; }
    .x:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; border-radius: 4px; }
    .footer { display: flex; gap: 16px; }
    .footer ::ng-deep > * { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VetModal {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  private readonly ref = inject(MatDialogRef, { optional: true });

  protected close(): void {
    this.ref?.close();
  }
}
