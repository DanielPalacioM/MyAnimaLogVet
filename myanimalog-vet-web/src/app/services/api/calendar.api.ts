import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CALENDAR_API } from '@auth/auth.config';
import { map, Observable } from 'rxjs';
import { mapApiError } from '../api-error';

/**
 * Cita de la clínica tal como la devuelve el calendar-service (Postman "Calendar Microservice", carpetas 2 y 3).
 * Confirmado por la colección: `id`, `status`, `origin`, `employeeId`, `startsAt`, `endsAt`. El resto (mascota,
 * servicio, precio, nota) se acepta con varios nombres y se completa con lo que ya conoce el panel.
 */
export interface AppointmentDto {
  id: string;
  status: string;
  origin?: string | null;
  employeeId?: string | null;
  petId?: string | null;
  petName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
  startsAt: string;
  endsAt?: string | null;
  notes?: string | null;
  pet?: { id?: string; name?: string } | null;
  service?: { id?: string; name?: string; durationMinutes?: number; price?: number } | null;
  employee?: { id?: string } | null;
}

export interface CreateAppointmentBody {
  serviceId: string;
  petId: string;
  employeeId: string;
  startsAt: string;
  notes?: string;
}

/** Acciones del ciclo de vida de una cita (`PATCH …/appointments/{id}/{acción}`). */
export type AppointmentAction = 'confirm' | 'reject' | 'check-in' | 'complete' | 'no-show' | 'cancel';

/**
 * Citas de la clínica. Todas llevan el token de clínica y la clínica va en la ruta (`TENANT_MISMATCH` si no coincide).
 * La base (`CALENDAR_API`) incluye `/api`; en desarrollo la resuelve `proxy.conf.cjs`.
 */
@Injectable({ providedIn: 'root' })
export class CalendarApi {
  private readonly http = inject(HttpClient);
  private readonly base = (id: string) => `${CALENDAR_API}/veterinaries/${id}/appointments`;

  /** Agenda en un rango (`from` incluido, `to` excluido). Responde `{ appointments: [...] }`. */
  list(veterinaryId: string, from: number, to: number): Observable<AppointmentDto[]> {
    const params = new HttpParams().set('from', new Date(from).toISOString()).set('to', new Date(to).toISOString());
    return this.http
      .get<{ appointments?: AppointmentDto[] } | AppointmentDto[]>(this.base(veterinaryId), { params })
      .pipe(map((res) => (Array.isArray(res) ? res : (res.appointments ?? []))), mapApiError());
  }

  /** La clínica agenda: nace `CONFIRMED` con origen `CLINIC`. `409 SLOT_UNAVAILABLE`, `409 EMPLOYEE_NOT_ELIGIBLE`. */
  create(veterinaryId: string, body: CreateAppointmentBody): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(this.base(veterinaryId), body).pipe(mapApiError());
  }

  /** `reject` exige `reason` (`400 VALIDATION_ERROR` si falta); `cancel` lo acepta. */
  act(veterinaryId: string, appointmentId: string, action: AppointmentAction, reason?: string): Observable<AppointmentDto> {
    const body = action === 'reject' || action === 'cancel' ? { reason } : null;
    return this.http.patch<AppointmentDto>(`${this.base(veterinaryId)}/${appointmentId}/${action}`, body).pipe(mapApiError());
  }

  reschedule(veterinaryId: string, appointmentId: string, startsAt: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.base(veterinaryId)}/${appointmentId}/reschedule`, { startsAt }).pipe(mapApiError());
  }
}
