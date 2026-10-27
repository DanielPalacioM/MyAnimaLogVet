import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { VetIcon } from '../icon/icon.component';

/** Pie de tabla con la paginación del diseño (cuadros de 32 px). */
@Component({
  selector: 'vet-pager',
  imports: [VetIcon],
  template: `
    <span class="range">{{ rangeLabel() }}</span>
    <nav class="pages" aria-label="Páginas">
      <button type="button" class="pg" [disabled]="page() === 1" (click)="go(page() - 1)" aria-label="Página anterior"><vet-icon name="left" [size]="14" /></button>
      @for (p of pages(); track $index) {
        <button type="button" class="pg" [class.on]="p === page()" [disabled]="p === '…'" [attr.aria-current]="p === page() ? 'page' : null" (click)="go(p)">{{ p }}</button>
      }
      <button type="button" class="pg" [disabled]="page() === pageCount()" (click)="go(page() + 1)" aria-label="Página siguiente"><vet-icon name="right" [size]="14" /></button>
    </nav>
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; color: #8a8a9a; font: 500 13px/1.25 'Afacad', sans-serif; }
    .pages { display: flex; gap: 6px; }
    .pg { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1.5px solid #e6e4f5; border-radius: 5px; background: #fff; color: #1a1a2e; font: 700 13px/1.25 'Afacad', sans-serif; cursor: pointer; }
    .pg.on { border-color: #4037be; background: #4037be; color: #fff; }
    .pg:disabled { cursor: default; opacity: 0.5; }
    .pg:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VetPager {
  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly rangeLabel = input.required<string>();
  readonly pageChange = output<number>();

  protected readonly pages = computed<(number | '…')[]>(() => {
    const n = this.pageCount();
    const c = this.page();
    if (n <= 5) return Array.from({ length: n }, (_, i) => i + 1);
    if (c <= 3) return [1, 2, 3, '…', n];
    if (c >= n - 2) return [1, '…', n - 2, n - 1, n];
    return [1, '…', c, '…', n];
  });

  protected go(p: number | '…'): void {
    if (p !== '…') this.pageChange.emit(Math.min(Math.max(1, p), this.pageCount()));
  }
}
