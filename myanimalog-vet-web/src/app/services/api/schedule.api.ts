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

/** Horario de la clínica y bloqueos (`/api/veterinary/{id}/business-hours` y `/schedule-blocks`, token de clínica). */
@Injectable({ providedIn: 'root' })
export class ScheduleApi {
  private readonly http = inject(HttpClient);
  private readonly base = (id: string) => `${VET_API}/${id}`;

  businessHours(veterinaryId: string): Observable<BusinessHourDto[]> {
    return this.http
      .get<BusinessHourDto[] | { businessHours?: BusinessHourDto[]; hours?: BusinessHourDto[]; days?: BusinessHourDto[] }>(`${this.base(veterinaryId)}/business-hours`)
      .pipe(map((res) => (Array.isArray(res) ? res : (res.businessHours ?? res.hours ?? res.days ?? []))), mapApiError());
  }

  /** Reemplaza la semana completa (`CLINIC_CONFIGURE`). No se pueden solapar tramos del mismo día. */
  replaceBusinessHours(veterinaryId: string, businessHours: { dayOfWeek: number; opensAt: string; closesAt: string }[]): Observable<unknown> {
    return this.http.put(`${this.base(veterinaryId)}/business-hours`, { businessHours }).pipe(mapApiError());
  }

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
