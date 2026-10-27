import { qrSvg } from './qr.component';

/** Descarga el QR como imagen SVG. */
export function downloadQr(code: string): void {
  const blob = new Blob([qrSvg(code)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qr-${code}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
