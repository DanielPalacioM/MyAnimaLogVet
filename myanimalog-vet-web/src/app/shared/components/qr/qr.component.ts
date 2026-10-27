import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const N = 25;
const FINDER = [
  [0, 0],
  [N - 7, 0],
  [0, N - 7],
];

const hash = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/**
 * Módulos del código: tres esquinas de ubicación y el resto según el texto. Es una representación visual del
 * diseño (no cumple el estándar QR); al conectar el backend, el QR real llega como imagen.
 */
export function qrModules(value: string): [number, number][] {
  let s = hash(value) || 1;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const inFinder = (x: number, y: number) => FINDER.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  const inLogo = (x: number, y: number) => x >= 10 && x <= 14 && y >= 10 && y <= 14;
  const out: [number, number][] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && !inLogo(x, y) && next() > 0.5) out.push([x, y]);
  return out;
}

/** SVG completo para descargar. */
export function qrSvg(value: string, px = 6, pad = 12): string {
  const size = N * px + pad * 2;
  const rects = qrModules(value).map(([x, y]) => `<rect x="${pad + x * px}" y="${pad + y * px}" width="${px}" height="${px}"/>`).join('');
  const finder = FINDER.map(([fx, fy]) => {
    const x = pad + fx * px;
    const y = pad + fy * px;
    return `<rect x="${x}" y="${y}" width="${7 * px}" height="${7 * px}" rx="6"/><rect x="${x + px}" y="${y + px}" width="${5 * px}" height="${5 * px}" rx="4" fill="#fff"/><rect x="${x + 2 * px}" y="${y + 2 * px}" width="${3 * px}" height="${3 * px}" rx="2"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#1a1a2e">${rects}${finder}</g><rect x="${size / 2 - 15}" y="${size / 2 - 15}" width="30" height="30" rx="8" fill="#4037be" stroke="#fff" stroke-width="3"/></svg>`;
}

/** Código QR de vinculación (Figma "Código QR", 174 px, módulos de 6 px). */
@Component({
  selector: 'vet-qr',
  template: `
    <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="'Código QR de vinculación ' + value()">
      <rect [attr.width]="size" [attr.height]="size" rx="12" fill="#fff" stroke="#e6e4f5" stroke-width="1.5" />
      <g fill="#1a1a2e">
        @for (m of modules(); track $index) {
          <rect [attr.x]="pad + m[0] * px" [attr.y]="pad + m[1] * px" [attr.width]="px" [attr.height]="px" />
        }
        @for (f of finders; track $index) {
          <rect [attr.x]="pad + f[0] * px" [attr.y]="pad + f[1] * px" [attr.width]="7 * px" [attr.height]="7 * px" rx="6" />
          <rect [attr.x]="pad + (f[0] + 1) * px" [attr.y]="pad + (f[1] + 1) * px" [attr.width]="5 * px" [attr.height]="5 * px" rx="4" fill="#fff" />
          <rect [attr.x]="pad + (f[0] + 2) * px" [attr.y]="pad + (f[1] + 2) * px" [attr.width]="3 * px" [attr.height]="3 * px" rx="2" />
        }
      </g>
      <rect [attr.x]="size / 2 - 15" [attr.y]="size / 2 - 15" width="30" height="30" rx="8" fill="#4037be" stroke="#fff" stroke-width="3" />
    </svg>
  `,
  styles: `:host { display: inline-block; line-height: 0; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VetQr {
  readonly value = input.required<string>();
  protected readonly px = 6;
  protected readonly pad = 12;
  protected readonly size = N * 6 + 24;
  protected readonly finders = FINDER;
  protected readonly modules = computed(() => qrModules(this.value()));
}
