import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { map, Observable } from 'rxjs';
import { mapApiError } from '../api-error';

/** Servicio del catálogo (veterinary-service). Se aceptan los nombres del maestro y variantes en snake_case. */
export interface ServiceDto {
  id: string;
  name: string;
  category?: string | null;
  durationMinutes?: number | null;
  duration_minutes?: number | null;
  price?: number | null;
  active?: boolean | null;
  bookableOnline?: boolean | null;
  bookable_online?: boolean | null;
  employeeIds?: string[] | null;
  professionalIds?: string[] | null;
}

export interface ServiceBody {
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  bookableOnline: boolean;
  employeeIds: string[];
}

/** Catálogo de servicios de la clínica (`/api/veterinary/{id}/services`, token de clínica). Crear y editar: `CLINIC_CONFIGURE`. */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly base = (id: string) => `${VET_API}/${id}/services`;

  list(veterinaryId: string): Observable<ServiceDto[]> {
    return this.http
      .get<ServiceDto[] | { services?: ServiceDto[]; items?: ServiceDto[] }>(this.base(veterinaryId))
      .pipe(map((res) => (Array.isArray(res) ? res : (res.services ?? res.items ?? []))), mapApiError());
  }

  create(veterinaryId: string, body: ServiceBody): Observable<ServiceDto> {
    return this.http.post<ServiceDto>(this.base(veterinaryId), body).pipe(mapApiError());
  }

  update(veterinaryId: string, serviceId: string, body: Partial<ServiceBody>): Observable<ServiceDto> {
    return this.http.patch<ServiceDto>(`${this.base(veterinaryId)}/${serviceId}`, body).pipe(mapApiError());
  }

  /** No se borra: hay citas que lo referencian. */
  deactivate(veterinaryId: string, serviceId: string): Observable<unknown> {
    return this.http.patch(`${this.base(veterinaryId)}/${serviceId}/deactivate`, null).pipe(mapApiError());
  }
}
