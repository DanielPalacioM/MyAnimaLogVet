export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type Species = 'Perro' | 'Gato' | 'Otro';
export type VaccineState = 'OK' | 'DUE' | 'OVERDUE' | 'NONE';

export interface Professional {
  id: string;
  name: string;
  initials: string;
  role: string;
  /** Color de fondo del avatar. */
  color: string;
  /** Médico veterinario con tarjeta verificada (muestra el escudo). */
  verified: boolean;
}

export type ServiceCategory = 'Consulta' | 'Vacunación' | 'Estética' | 'Laboratorio' | 'Cirugía' | 'Otro';

export interface ClinicService {
  id: string;
  name: string;
  category: ServiceCategory;
  minutes: number;
  /** Precio en pesos colombianos. */
  price: number;
  /** Los dueños pueden pedirlo desde la app. */
  online: boolean;
  /** Un servicio con citas no se borra: se desactiva. */
  active: boolean;
  /** Quién lo presta. */
  professionalIds: string[];
}

export interface Patient {
  id: string;
  name: string;
  species: Species;
  breed: string;
  age: string;
  owner: string;
  phone: string;
  /** Texto de la última visita: "22 sep", "Hoy". */
  lastVisit: string;
  lastVisitService: string;
  /** Para ordenar (ms). */
  lastVisitAt: number;
  vaccines: VaccineState;
  inApp: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  service: string;
  professionalId: string;
  /** Inicio en ms. */
  start: number;
  minutes: number;
  status: AppointmentStatus;
  source: 'APP' | 'CLINIC';
  note?: string;
}

export interface NewAppointment {
  patientId: string;
  service: string;
  professionalId: string;
  start: number;
  minutes: number;
}

export interface NewPatient {
  name: string;
  species: Species;
  breed: string;
  age: string;
  owner: string;
  phone: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  sentAt: number;
  expiresAt: number;
}

export type MemberRole = 'OWNER' | 'ADMIN' | 'VET' | 'ASSISTANT' | 'RECEPTION';
/** Tarjeta profesional: verificada, en revisión o no aplica (auxiliares y recepción). */
export type LicenseState = 'VERIFIED' | 'IN_REVIEW' | 'NA';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** "Dueña", "Veterinaria"… (con el género de la persona). */
  roleLabel: string;
  license: LicenseState;
  active: boolean;
  joinedAt: number;
  /** Solo veterinarios. */
  profession?: string;
  card?: string;
  specialty?: string;
  university?: string;
  cardSentAt?: string;
  /** "Lun a vie · 8:00 a. m. – 2:00 p. m." */
  schedule: string;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  VET: 'Veterinario',
  ASSISTANT: 'Auxiliar',
  RECEPTION: 'Recepción',
};

export interface ScheduleDay {
  /** 0 = lunes … 6 = domingo. */
  day: number;
  open: boolean;
  /** Tramos "HH:MM" – "HH:MM". */
  ranges: [string, string][];
}

export interface ClinicBlock {
  id: string;
  title: string;
  /** Primer día (ms, inicio del día). */
  date: number;
  /** Último día, si dura varios. */
  endDate?: number;
  /** 'CLINIC' o el id del profesional. */
  scope: string;
  allDay: boolean;
  from?: string;
  to?: string;
}

export interface ClinicProfile {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  onlineBooking: boolean;
  confirmEach: boolean;
  minCancelHours: number;
  defaultMinutes: number;
  inDirectory: boolean;
}

/** Dueño vinculado: se arma a partir de los pacientes compartidos con la clínica. */
export interface Client {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  pets: Patient[];
  linkedAt: number;
  via: 'QR' | 'CLAIM';
  claimedPet?: string;
  lastVisit: string;
  lastVisitAt: number;
  next: Appointment | null;
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  REQUESTED: 'Por confirmar',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En la clínica',
  COMPLETED: 'Atendida',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

/** Colores de estado (DISENO §4). */
export const STATUS_COLOR: Record<AppointmentStatus, { fg: string; bg: string; border: string }> = {
  REQUESTED: { fg: '#B26A00', bg: '#FFF4E0', border: '#F5A623' },
  CONFIRMED: { fg: '#4037BE', bg: '#F1F0FB', border: '#4037BE' },
  CHECKED_IN: { fg: '#00796B', bg: '#E0FFFA', border: '#00796B' },
  COMPLETED: { fg: '#2E7D32', bg: '#E8F5E9', border: '#2E7D32' },
  CANCELLED: { fg: '#6B6B80', bg: '#F0F0F3', border: '#6B6B80' },
  NO_SHOW: { fg: '#6B6B80', bg: '#F0F0F3', border: '#6B6B80' },
};

/** Una cita "cuenta" en la agenda si no está cancelada ni fue inasistencia. */
export const isActive = (a: Appointment) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW';
