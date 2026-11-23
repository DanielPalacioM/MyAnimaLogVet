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

/** Cuerpo propuesto para registrar una mascota sin app. */
export interface NewPatientBody {
  name: string;
  species: 'DOG' | 'CAT' | 'OTHER';
  breed: string;
  /** `YYYY-MM-DD`. */
  birthDate?: string;
  sex?: 'MALE' | 'FEMALE';
  owner: { fullName: string; email: string; phone?: string };
}

export interface RegisteredPatientDto {
  petId: string;
  claimInvitation?: { email: string; expiresAt: string } | null;
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

  /**
   * Registrar una mascota **sin app** (la clínica la crea y manda una invitación al correo del dueño para reclamarla).
   * ⚠ El backend aún no publica esta ruta (flag `patients` apagada): el contrato es una propuesta, ver `docs/ESTADO_RUTAS_Y_BRECHAS.md`.
   * Se espera `201 { petId, claimInvitation: { email, expiresAt } }`; `409 OWNER_ALREADY_REGISTERED` si el correo ya tiene cuenta
   * (entonces debe vincularse con el código).
   */
  registerPatient(veterinaryId: string, body: NewPatientBody): Observable<RegisteredPatientDto> {
    return this.http.post<RegisteredPatientDto>(`${VET_API}/${veterinaryId}/patients`, body).pipe(mapApiError());
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
