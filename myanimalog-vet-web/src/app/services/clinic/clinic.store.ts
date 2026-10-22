import { computed, Injectable, signal } from '@angular/core';
import { buildAppointments, buildPatients, PROFESSIONALS, SERVICES, TODAY } from './clinic.seed';
import { Appointment, AppointmentStatus, Invitation, isActive, NewAppointment, NewPatient, Patient } from './clinic.models';
import { sameDay } from './date.utils';

/**
 * Datos de prueba de la clínica (pacientes, citas, solicitudes). Hoy viven en memoria y se reinician al recargar;
 * al conectar el backend, esta clase se reemplaza por llamadas HTTP y las vistas no cambian.
 */
@Injectable({ providedIn: 'root' })
export class ClinicStore {
  readonly professionals = PROFESSIONALS;
  readonly services = SERVICES;

  readonly patients = signal<Patient[]>(buildPatients(TODAY()));
  readonly appointments = signal<Appointment[]>(buildAppointments(TODAY(), this.patients()));
  readonly invitations = signal<Invitation[]>([{ id: 'i1', name: 'Sofía', sentAgo: 'hace 2 días' }]);
  /** Pacientes a los que ya se les avisó por la vacuna vencida (se quitan de "Por resolver"). */
  readonly notifiedVaccines = signal<ReadonlySet<string>>(new Set());
  /** Reloj en ms (se actualiza cada minuto) para "próxima cita" y la línea de "ahora". */
  readonly now = signal(Date.now());

  /** Código para vincular dueños en recepción (QR). */
  readonly linkCode = 'PAT-4821';

  readonly todayAppointments = computed(() =>
    this.appointments()
      .filter((a) => sameDay(a.start, this.now()))
      .sort((a, b) => a.start - b.start),
  );
  readonly todayActiveCount = computed(() => this.todayAppointments().filter(isActive).length);
  readonly pendingRequests = computed(() => this.appointments().filter((a) => a.status === 'REQUESTED' && a.source === 'APP'));
  readonly overdueVaccines = computed(() => this.patients().filter((p) => p.vaccines === 'OVERDUE'));
  readonly vaccinesToNotify = computed(() => this.overdueVaccines().filter((p) => !this.notifiedVaccines().has(p.id)));

  constructor() {
    setInterval(() => this.now.set(Date.now()), 60_000);
  }

  patient(id: string): Patient | undefined {
    return this.patients().find((p) => p.id === id);
  }

  professional(id: string) {
    return this.professionals.find((p) => p.id === id);
  }

  // ---- Citas ----

  /** ¿El profesional ya tiene una cita activa que se cruce con este horario? */
  hasConflict(professionalId: string, start: number, minutes: number, ignoreId?: string): boolean {
    const end = start + minutes * 60_000;
    return this.appointments().some(
      (a) =>
        a.id !== ignoreId &&
        a.professionalId === professionalId &&
        isActive(a) &&
        a.start < end &&
        start < a.start + a.minutes * 60_000,
    );
  }

  addAppointment(input: NewAppointment): Appointment {
    const patient = this.patient(input.patientId)!;
    const appointment: Appointment = {
      id: `a-${Date.now()}`,
      patientName: patient.name,
      status: 'CONFIRMED',
      source: 'CLINIC',
      ...input,
    };
    this.appointments.update((list) => [...list, appointment]);
    return appointment;
  }

  setStatus(id: string, status: AppointmentStatus): void {
    this.appointments.update((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  // ---- Pacientes ----

  addPatient(input: NewPatient): Patient {
    const patient: Patient = {
      id: `p-${Date.now()}`,
      ...input,
      lastVisit: 'Sin visitas',
      lastVisitService: '—',
      lastVisitAt: 0,
      vaccines: 'NONE',
      inApp: false,
    };
    this.patients.update((list) => [patient, ...list]);
    return patient;
  }

  // ---- Pendientes ----

  notifyVaccine(patientId: string): void {
    this.notifiedVaccines.update((s) => new Set(s).add(patientId));
  }

  resendInvitation(id: string): void {
    this.invitations.update((list) => list.map((i) => (i.id === id ? { ...i, sentAgo: 'hace un momento' } : i)));
  }
}
