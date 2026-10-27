import { Patient, VaccineState } from './clinic.models';
import { dayMonth } from './date.utils';

/** Datos de la ficha que aún no vienen del backend: se derivan del paciente para que sean estables. */
export interface PatientExtras {
  sex: 'macho' | 'hembra';
  weightKg: string;
  microchip: string;
  since: string;
  sharedBy: string;
  alert: string | null;
  history: { date: string; title: string; by: string }[];
}

const DAY = 86_400_000;
const ALERTS = ['Alérgico a la penicilina.', 'Tiene la cadera sensible: manipular con cuidado.', 'Se estresa con los ladridos en sala de espera.'];
const HISTORY_BY = ['Dra. Sara Ruiz', 'Dr. Luis Pérez'];

const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const SERVICE_PRICE: Record<string, number> = {
  'Consulta general': 60_000,
  Vacunación: 40_000,
  'Control posoperatorio': 45_000,
  Desparasitación: 30_000,
  'Baño y corte': 55_000,
};

export const money = (n: number): string => `$${n.toLocaleString('es-CO')}`;

export function patientExtras(p: Patient): PatientExtras {
  const h = hash(p.id + p.name);
  const weight = p.species === 'Gato' ? 3 + (h % 40) / 10 : 5 + (h % 250) / 10;
  const digits = String(h).padStart(9, '0');
  const chip = `985 112 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  const sinceMonth = new Date(2026, 2 + (h % 5), 3 + (h % 20));
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const older = p.lastVisitAt - 30 * DAY;
  return {
    sex: h % 2 === 0 ? 'macho' : 'hembra',
    weightKg: weight.toFixed(1).replace('.', ','),
    microchip: chip,
    since: `${sinceMonth.getDate()} de ${months[sinceMonth.getMonth()]} de ${sinceMonth.getFullYear()}`,
    sharedBy: p.owner.split(' ')[0],
    alert: h % 5 === 0 ? ALERTS[h % ALERTS.length] : null,
    history: [
      { date: p.lastVisit === 'Hoy' ? 'Hoy' : p.lastVisit, title: p.lastVisitService, by: HISTORY_BY[h % 2] },
      { date: dayMonth(older), title: 'Vacuna antirrábica', by: HISTORY_BY[(h + 1) % 2] },
    ],
  };
}

/** Etiqueta y colores de cada estado de vacunas (chips del diseño). */
export const VACCINE: Record<VaccineState, { label: string; sheet: string; fg: string; bg: string }> = {
  OK: { label: 'Al día', sheet: 'Vacunas al día', fg: '#2E7D32', bg: '#E8F5E9' },
  DUE: { label: 'Por vencer', sheet: 'Vacunas por vencer', fg: '#B26A00', bg: '#FFF4E0' },
  OVERDUE: { label: 'Vencida', sheet: 'Vacunas vencidas', fg: '#B42318', bg: '#FEF3F2' },
  NONE: { label: 'Sin registro', sheet: 'Sin registro de vacunas', fg: '#6B6B80', bg: '#F0F0F3' },
};
