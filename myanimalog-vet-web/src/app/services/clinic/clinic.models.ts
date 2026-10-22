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

export interface ClinicService {
  id: string;
  name: string;
  minutes: number;
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
  name: string;
  sentAgo: string;
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
  NO_SHOW: { fg: '#3D3D4E', bg: '#E6E6EB', border: '#3D3D4E' },
};

/** Una cita "cuenta" en la agenda si no está cancelada ni fue inasistencia. */
export const isActive = (a: Appointment) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW';
