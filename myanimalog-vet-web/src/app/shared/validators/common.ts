import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Nombre y apellido: al menos dos palabras con letras. */
export const fullNameValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  const words = value.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  return words.length >= 2 && value.length >= 5
    ? null
    : { fullName: { message: 'Escribe nombre y apellido completos.' } };
};

/**
 * Nombre completo del dueño con las reglas del User service (FullNamePolicy, docs/NOMBRE_Y_TELEFONO.md):
 * 2 a 100 caracteres; letras (con tildes y ñ), espacios, guion y apóstrofe. Se recorta y se colapsan espacios.
 * Así el nombre que pone la clínica al "registrar sin app" es uno que el dueño también puede tener en su cuenta.
 */
export const ownerFullNameValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim().replace(/\s+/g, ' ');
  if (!value) return null;
  if (value.length < 2 || value.length > 100) return { fullName: { message: 'El nombre debe tener entre 2 y 100 caracteres.' } };
  return /^[\p{L}\p{M}' -]+$/u.test(value)
    ? null
    : { fullName: { message: 'Usa solo letras, espacios, guion (-) o apóstrofe (\').' } };
};

/**
 * Teléfono del dueño tal como lo escribe la persona: "3001234567", "300 123 4567" o "+57 300 123 4567".
 * Se manda en E.164 (+57…), igual que lo guarda el User service.
 */
export const ownerPhoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/[\s().-]/g, '').replace(/^\+?57(?=\d{10}$)/, '');
  return /^(3\d{9}|60\d{8})$/.test(digits)
    ? null
    : { phone: { message: 'Escribe un celular o fijo de 10 dígitos, por ejemplo 300 123 4567.' } };
};

/** Celular (3XXXXXXXXX) o fijo con indicativo (60XXXXXXXX): 10 dígitos. */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  return /^(3\d{9}|60\d{8})$/.test(value)
    ? null
    : { phone: { message: 'Escribe 10 dígitos, por ejemplo 3001234567.' } };
};

export const documentNumberValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  return /^\d{5,12}$/.test(value)
    ? null
    : { documentNumber: { message: 'Escribe solo números (entre 5 y 12 dígitos).' } };
};

export const licenseNumberValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  return /^[A-Za-z0-9.\-]{3,20}$/.test(value)
    ? null
    : { license: { message: 'Usa de 3 a 20 letras, números, puntos o guiones.' } };
};

export const passwordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  return value.length >= 8 ? null : { password: { message: 'Usa mínimo 8 caracteres.' } };
};

/** Deja solo dígitos (para NIT, teléfono y documento escritos con puntos, espacios o guiones). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
