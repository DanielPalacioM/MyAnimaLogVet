import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { map, Observable } from 'rxjs';
import { mapApiError } from '../api-error';

/**
 * Tramo del horario de atención. Forma del `schedule-rules` del maestro §8: `dayOfWeek` 1 = lunes … 7 = domingo,
 * horas "HH:MM". Se aceptan también `startsAt`/`endsAt`. Varios tramos el mismo día = descanso en medio.
 */
export interface BusinessHourDto {
  dayOfWeek: number;
  opensAt?: string | null;
  closesAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** Bloqueo de agenda: de toda la clínica (`employeeId` nulo) o de un profesional. */
export interface ScheduleBlockDto {
  id: string;
  employeeId?: string | null;
  startsAt: string;
  endsAt: string;
  title?: string | null;
  reason?: string | null;
}

export interface ScheduleBlockBody {
  employeeId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string;
}

/** Horario propio de un empleado (carpeta 17). `usesClinicHours`: sin filas propias, atiende en el horario de la clínica. */
export interface EmployeeScheduleDto {
  employeeId: string;
  timezone?: string | null;
  usesClinicHours: boolean;
  items: BusinessHourDto[];
}

/** Máximo de días que acepta `GET /schedule-blocks` por consulta. */
export const BLOCKS_MAX_DAYS = 92;

/** Horario de la clínica, de cada empleado y bloqueos (Postman carpetas 16, 17 y 18; token de clínica). */
@Injectable({ providedIn: 'root' })
export class ScheduleApi {
  private readonly http = inject(HttpClient);
  private readonly base = (id: string) => `${VET_API}/${id}`;

  businessHours(veterinaryId: string): Observable<BusinessHourDto[]> {
    return this.http
      .get<BusinessHourDto[] | { items?: BusinessHourDto[]; businessHours?: BusinessHourDto[] }>(`${this.base(veterinaryId)}/business-hours`)
      .pipe(map((res) => (Array.isArray(res) ? res : (res.items ?? res.businessHours ?? []))), mapApiError());
  }

  /**
   * Reemplaza la semana completa (`CLINIC_CONFIGURE`). El cuerpo es un **arreglo simple**; `[]` deja la clínica sin horario.
   * `400 INVALID_BUSINESS_HOURS`: tramos solapados, más de 4 por día o `closesAt <= opensAt`.
   */
  replaceBusinessHours(veterinaryId: string, hours: { dayOfWeek: number; opensAt: string; closesAt: string }[]): Observable<unknown> {
    return this.http.put(`${this.base(veterinaryId)}/business-hours`, hours).pipe(mapApiError());
  }

  employeeSchedule(veterinaryId: string, employeeId: string): Observable<EmployeeScheduleDto> {
    return this.http.get<EmployeeScheduleDto>(`${this.base(veterinaryId)}/employees/${employeeId}/schedule`).pipe(
      map((r) => ({ employeeId: r?.employeeId ?? employeeId, timezone: r?.timezone ?? null, usesClinicHours: !!r?.usesClinicHours || !(r?.items ?? []).length, items: r?.items ?? [] })),
      mapApiError(),
    );
  }

  /** Arreglo simple; `[]` borra el horario propio y lo vuelve al de la clínica (no lo deja sin atender). */
  replaceEmployeeSchedule(veterinaryId: string, employeeId: string, hours: { dayOfWeek: number; opensAt: string; closesAt: string }[]): Observable<unknown> {
    return this.http.put(`${this.base(veterinaryId)}/employees/${employeeId}/schedule`, hours).pipe(mapApiError());
  }

  /** Un rango de máximo `BLOCKS_MAX_DAYS` días; devuelve los que se solapan con `[from, to)`. */
  blocks(veterinaryId: string, from: number, to: number): Observable<ScheduleBlockDto[]> {
    const params = new HttpParams().set('from', new Date(from).toISOString()).set('to', new Date(to).toISOString());
    return this.http
      .get<ScheduleBlockDto[] | { blocks?: ScheduleBlockDto[]; items?: ScheduleBlockDto[] }>(`${this.base(veterinaryId)}/schedule-blocks`, { params })
      .pipe(map((res) => (Array.isArray(res) ? res : (res.blocks ?? res.items ?? []))), mapApiError());
  }

  createBlock(veterinaryId: string, body: ScheduleBlockBody): Observable<unknown> {
    return this.http.post(`${this.base(veterinaryId)}/schedule-blocks`, body).pipe(mapApiError());
  }

  deleteBlock(veterinaryId: string, blockId: string): Observable<unknown> {
    return this.http.delete(`${this.base(veterinaryId)}/schedule-blocks/${blockId}`).pipe(mapApiError());
  }
}
