export const DAY_MS = 86_400_000;

export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const sameDay = (a: number, b: number): boolean => startOfDay(a) === startOfDay(b);

/** Lunes de la semana de `ms`. */
export const startOfWeek = (ms: number): number => {
  const d = new Date(startOfDay(ms));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
};

export const addDays = (ms: number, days: number): number => {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
};

/** 8:00 a. m. */
export const timeLabel = (ms: number): string => {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

export const hourParts = (ms: number): { time: string; suffix: string } => {
  const [time, ...rest] = timeLabel(ms).split(' ');
  return { time, suffix: rest.join(' ') };
};

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const monthName = (m: number) => MONTHS[m];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Martes, 6 de octubre" */
export const longDate = (ms: number): string => {
  const d = new Date(ms);
  return `${cap(DAYS[d.getDay()])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

/** "Mar 7 oct" */
export const shortDate = (ms: number): string => {
  const d = new Date(ms);
  return `${cap(DAYS[d.getDay()].slice(0, 3))} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

/** "22 sep" */
export const dayMonth = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export const isoDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const at = (dayStart: number, hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayStart);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
