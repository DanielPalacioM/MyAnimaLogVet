import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Pesos de la DIAN, de derecha a izquierda. */
const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71] as const;

/** Dígito de verificación (DV) de un NIT colombiano según el algoritmo de la DIAN. */
export function nitCheckDigit(nit: string): number {
  const digits = nit.split('').reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * WEIGHTS[i], 0);
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

/** "900123456" → "900.123.456" */
export function formatNit(nit: string, dv?: string): string {
  const grouped = nit.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dv ? `${grouped}-${dv}` : grouped;
}

export const NIT_PATTERN = /^\d{9}$/;

/** Validador del campo NIT: 9 dígitos (sin guion ni puntos). */
export const nitFormatValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  return NIT_PATTERN.test(value)
    ? null
    : { nit: { message: 'El NIT tiene 9 dígitos, sin puntos ni guion. Ejemplo: 900123456.' } };
};

/** Validador del campo DV: un dígito que coincida con el NIT del mismo grupo. */
export const nitDvValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const dv = String(control.value ?? '');
  if (!dv) return null;
  if (!/^\d$/.test(dv)) return { nitDv: { message: 'El DV es un solo dígito.' } };
  const nit = String(control.parent?.get('nit')?.value ?? '');
  if (!NIT_PATTERN.test(nit)) return null; // el campo NIT ya muestra su propio error
  return nitCheckDigit(nit) === Number(dv)
    ? null
    : { nitDv: { message: 'El dígito de verificación no corresponde a este NIT. Revísalo en tu RUT.' } };
};
