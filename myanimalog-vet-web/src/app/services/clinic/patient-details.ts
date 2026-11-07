import { VaccineState } from './clinic.models';

export const money = (n: number): string => `$${n.toLocaleString('es-CO')}`;

/** Etiqueta y colores de cada estado de vacunas (chips del diseño). */
export const VACCINE: Record<VaccineState, { label: string; sheet: string; fg: string; bg: string }> = {
  OK: { label: 'Al día', sheet: 'Vacunas al día', fg: '#2E7D32', bg: '#E8F5E9' },
  DUE: { label: 'Por vencer', sheet: 'Vacunas por vencer', fg: '#B26A00', bg: '#FFF4E0' },
  OVERDUE: { label: 'Vencida', sheet: 'Vacunas vencidas', fg: '#B42318', bg: '#FEF3F2' },
  NONE: { label: 'Sin registro', sheet: 'Sin registro de vacunas', fg: '#6B6B80', bg: '#F0F0F3' },
};
