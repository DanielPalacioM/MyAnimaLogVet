import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { Observable } from 'rxjs';
import { mapApiError } from '../api-error';

/** Página de resultados del veterinary-service (`items` + `page` desde 0, `size`, `total`). */
export interface PageDto<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

/** Dueño vinculado a la clínica (Postman 14 · `GET /{id}/clients`). */
export interface ClientDto {
  userId: string;
  name: string | null;
  email: string | null;
  linkedAt: string;
  sharedPetsCount: number;
}

/** Mascota compartida con la clínica (Postman 14 · `GET /{id}/patients`). Datos de Pets en vivo. */
export interface PatientDto {
  petId: string;
  name: string;
  species: string | null;
  breed: string | null;
  photoUrl: string | null;
  ownerUserId: string;
  grantedAt: string;
  /** Solo en el detalle. */
  sex?: string | null;
  birthDate?: string | null;
  weight?: number | null;
}

export interface UnlinkClientDto {
  userId: string;
  veterinaryId: string;
  revokedPetsCount: number;
  message: string;
}

/**
 * Dueños vinculados y mascotas compartidas, vistos desde la clínica (token de clínica; Postman, carpeta 14).
 * Vincularse y compartir lo hace el dueño desde su app (carpeta 11): el panel no lo llama.
 * Las rutas viejas `link/code`, `link/url` y `link/{id}/user/{userId}` quedaron deprecadas y se quitaron.
 */
@Injectable({ providedIn: 'root' })
export class LinkApi {
  private readonly http = inject(HttpClient);

  /** Código `VET-XXXXXXXX` vigente, sin regenerarlo. `inviteCode` es `null` si no hay (o fue revocado). */
  linkCode(veterinaryId: string): Observable<{ inviteCode: string | null; inviteLink?: string | null }> {
    return this.http.get<{ inviteCode: string | null; inviteLink?: string | null }>(`${VET_API}/${veterinaryId}/link-code`).pipe(mapApiError());
  }

  clients(veterinaryId: string, page = 0, size = 100): Observable<PageDto<ClientDto>> {
    return this.http
      .get<PageDto<ClientDto>>(`${VET_API}/${veterinaryId}/clients`, { params: new HttpParams().set('page', page).set('size', size) })
      .pipe(mapApiError());
  }

  /** Quitar cliente (`CLINIC_CONFIGURE`): revoca sus mascotas y limpia correo y teléfono del lado de la clínica. `404 USER_NOT_LINKED`. */
  removeClient(veterinaryId: string, clientUserId: string): Observable<UnlinkClientDto> {
    return this.http.delete<UnlinkClientDto>(`${VET_API}/${veterinaryId}/clients/${clientUserId}`).pipe(mapApiError());
  }

  patients(veterinaryId: string, page = 0, size = 100): Observable<PageDto<PatientDto>> {
    return this.http
      .get<PageDto<PatientDto>>(`${VET_API}/${veterinaryId}/patients`, { params: new HttpParams().set('page', page).set('size', size) })
      .pipe(mapApiError());
  }

  /** `404 PATIENT_NOT_FOUND` si nunca se compartió o se revocó. */
  patient(veterinaryId: string, petId: string): Observable<PatientDto> {
    return this.http.get<PatientDto>(`${VET_API}/${veterinaryId}/patients/${petId}`).pipe(mapApiError());
  }
}
