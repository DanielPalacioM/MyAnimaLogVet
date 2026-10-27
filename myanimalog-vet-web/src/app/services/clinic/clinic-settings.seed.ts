import { ClinicBlock, ClinicProfile, ClinicService, Invitation, Member, ScheduleDay } from './clinic.models';
import { addDays } from './date.utils';

/** Catálogo de servicios (Figma 1971:225). */
export const CATALOG: ClinicService[] = [
  { id: 's1', name: 'Consulta general', category: 'Consulta', minutes: 30, price: 60_000, online: true, active: true, professionalIds: ['luis', 'sara'] },
  { id: 's2', name: 'Vacunación', category: 'Vacunación', minutes: 15, price: 45_000, online: true, active: true, professionalIds: ['luis', 'sara'] },
  { id: 's3', name: 'Control posoperatorio', category: 'Consulta', minutes: 20, price: 35_000, online: true, active: true, professionalIds: ['luis', 'sara'] },
  { id: 's4', name: 'Baño y corte', category: 'Estética', minutes: 60, price: 55_000, online: true, active: true, professionalIds: ['camila'] },
  { id: 's5', name: 'Hemograma completo', category: 'Laboratorio', minutes: 15, price: 40_000, online: true, active: true, professionalIds: ['luis', 'sara'] },
  { id: 's6', name: 'Esterilización felina', category: 'Cirugía', minutes: 120, price: 280_000, online: false, active: true, professionalIds: ['luis', 'sara'] },
  { id: 's7', name: 'Ecografía abdominal', category: 'Otro', minutes: 40, price: 120_000, online: false, active: false, professionalIds: ['luis'] },
];

/** Lun a vie 8–12 y 14–18, sábado 8–13, domingo cerrado. */
export const SCHEDULE: ScheduleDay[] = [
  ...[0, 1, 2, 3, 4].map((day): ScheduleDay => ({ day, open: true, ranges: [['08:00', '12:00'], ['14:00', '18:00']] })),
  { day: 5, open: true, ranges: [['08:00', '13:00']] },
  { day: 6, open: false, ranges: [] },
];

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day).getTime();

/** Equipo (Figma 1965:219). La dueña es quien tiene la sesión. */
export const MEMBERS: Member[] = [
  { id: 'ana', name: 'Ana Gómez', email: 'ana.gomez@correo.com', role: 'OWNER', roleLabel: 'Dueña', license: 'VERIFIED', active: true, joinedAt: d(2026, 9, 1), profession: 'Médica veterinaria (MV)', card: 'MV-19004', specialty: 'Medicina general', university: 'Universidad de Cartagena', schedule: 'Lun a vie · 8:00 a. m. – 2:00 p. m.' },
  { id: 'luis', name: 'Luis Pérez', email: 'luis.perez@correo.com', role: 'VET', roleLabel: 'Veterinario', license: 'VERIFIED', active: true, joinedAt: d(2026, 9, 3), profession: 'Médico veterinario (MV)', card: 'MV-22310', specialty: 'Cirugía', university: 'Universidad CES', schedule: 'Lun a vie · 8:00 a. m. – 2:00 p. m.' },
  { id: 'sara', name: 'Sara Ruiz', email: 'sara.ruiz@correo.com', role: 'VET', roleLabel: 'Veterinaria', license: 'VERIFIED', active: true, joinedAt: d(2026, 9, 3), profession: 'Médica veterinaria (MV)', card: 'MV-25871', specialty: 'Medicina felina', university: 'Universidad de Antioquia', schedule: 'Lun a vie · 10:00 a. m. – 6:00 p. m.' },
  { id: 'julian', name: 'Julián Rojas', email: 'julian.rojas@correo.com', role: 'VET', roleLabel: 'Veterinario', license: 'IN_REVIEW', active: true, joinedAt: d(2026, 10, 2), profession: 'Médico veterinario (MV)', card: 'MV-28417', specialty: 'Medicina felina', university: 'Universidad de Cartagena', cardSentAt: '2 oct', schedule: 'Lun a vie · 8:00 a. m. – 2:00 p. m.' },
  { id: 'camila', name: 'Camila Mora', email: 'camila.mora@correo.com', role: 'ASSISTANT', roleLabel: 'Auxiliar', license: 'NA', active: true, joinedAt: d(2026, 9, 10), schedule: 'Mar a sáb · 9:00 a. m. – 5:00 p. m.' },
  { id: 'sofia', name: 'Sofía Martínez', email: 'sofia.martinez@correo.com', role: 'RECEPTION', roleLabel: 'Recepción', license: 'NA', active: true, joinedAt: d(2026, 9, 10), schedule: 'Lun a vie · 8:00 a. m. – 5:00 p. m.' },
  { id: 'pedro', name: 'Pedro Gil', email: 'pedro.gil@correo.com', role: 'ASSISTANT', roleLabel: 'Auxiliar', license: 'NA', active: false, joinedAt: d(2026, 9, 15), schedule: '—' },
];

const DAY = 86_400_000;

/** Una pendiente (vence en 5 días) y una vencida, como el diseño. */
export function buildInvitations(now: number): Invitation[] {
  return [
    { id: 'i1', email: 'diana.lopez@correo.com', role: 'RECEPTION', invitedBy: 'Ana Gómez', sentAt: now - 2 * DAY, expiresAt: now + 5 * DAY },
    { id: 'i2', email: 'm.quintero@correo.com', role: 'VET', invitedBy: 'Ana Gómez', sentAt: now - 10 * DAY, expiresAt: now - 3 * DAY },
  ];
}

/** Bloqueos próximos, relativos a hoy. */
export function buildBlocks(today: number): ClinicBlock[] {
  return [
    { id: 'b1', title: 'Festivo', date: addDays(today, 2), scope: 'CLINIC', allDay: true },
    { id: 'b2', title: 'Cirugía programada', date: addDays(today, 3), scope: 'sara', allDay: false, from: '10:00', to: '12:00' },
    { id: 'b3', title: 'Vacaciones', date: addDays(today, 10), endDate: addDays(today, 14), scope: 'luis', allDay: true },
  ];
}

export const PROFILE: ClinicProfile = {
  name: 'Clínica Veterinaria Patitas',
  phone: '+57 300 123 4567',
  email: 'hola@clinicapatitas.co',
  city: 'Cartagena, Bolívar',
  address: 'Cra. 3 #8-129, Bocagrande',
  onlineBooking: true,
  confirmEach: true,
  minCancelHours: 4,
  defaultMinutes: 30,
  inDirectory: true,
};

export const CITIES = ['Cartagena, Bolívar', 'Barranquilla, Atlántico', 'Bogotá, D.C.', 'Medellín, Antioquia', 'Cali, Valle del Cauca', 'Santa Marta, Magdalena', 'Bucaramanga, Santander'];

/** Datos de vinculación de los dueños del diseño (Figma 1964:219). El resto se deriva. */
export const CLIENT_OVERRIDES: Record<string, { email: string; linkedAt: number; via: 'QR' | 'CLAIM'; claimedPet?: string }> = {
  'Carlos Mendoza': { email: 'carlos.mendoza@correo.com', linkedAt: d(2026, 3, 3), via: 'QR' },
  'Valentina Ríos': { email: 'vale.rios@correo.com', linkedAt: d(2026, 1, 15), via: 'CLAIM', claimedPet: 'Luna' },
  'Laura Gómez': { email: 'lauragomez@correo.com', linkedAt: d(2026, 2, 2), via: 'QR' },
  'Andrés Torres': { email: 'andres.torres@correo.com', linkedAt: d(2026, 9, 28), via: 'QR' },
  'Marta Lucía Díaz': { email: 'martalu.diaz@correo.com', linkedAt: d(2025, 11, 11), via: 'QR' },
  'Juliana Castro': { email: 'juli.castro@correo.com', linkedAt: d(2026, 5, 5), via: 'QR' },
  'Felipe Herrera': { email: 'fherrera@correo.com', linkedAt: d(2026, 8, 19), via: 'QR' },
};

/** Datos legales que pasaron la verificación (Figma "Datos legales"). */
export const LEGAL = { businessName: 'Patitas SAS', nit: '901234567-8', legalRep: 'Ana María Gómez' };
