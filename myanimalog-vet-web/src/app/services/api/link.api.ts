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
  /** `null` mientras la mascota está sin reclamar. */
  ownerUserId: string | null;
  grantedAt: string;
  /** Mascota registrada por la clínica: `UNCLAIMED` hasta que el dueño la reclame. */
  claimStatus?: string | null;
  claim?: { status?: string | null; invitationEmail?: string | null; invitationSentAt?: string | null; invitationExpiresAt?: string | null } | null;
  /** Contacto del dueño que dejó la clínica (solo mientras está sin reclamar). */
  ownerContact?: { fullName?: string | null; email?: string | null; phone?: string | null } | null;
  /** Solo en el detalle. */
  sex?: string | null;
  birthDate?: string | null;
  weight?: number | null;
}

/** Cuerpo de `POST /{id}/patients/walk-in`. */
export interface NewPatientBody {
  pet: { name: string; species: 'DOG' | 'CAT' | 'OTHER'; breed: string; sex?: 'MALE' | 'FEMALE'; /** `YYYY-MM-DD`. */ birthDate?: string };
  owner: { fullName: string; email: string; phone?: string; documentType: 'CC' | 'CE' | 'PPT'; documentNumber: string };
  /** Manda al correo del dueño la invitación para reclamar la mascota. */
  sendClaimInvitation: boolean;
}

/** Respuesta de registrar sin app. No está documentada: se aceptan las formas probables. */
export interface RegisteredPatientDto {
  petId?: string;
  id?: string;
  pet?: { id?: string; petId?: string } | null;
  claimInvitation?: { email?: string | null; expiresAt?: string | null } | null;
  invitationEmail?: string | null;
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
   * Registrar una mascota **sin app** (`POST /{id}/patients/walk-in`, contrato del maestro §7.3): la clínica la crea y, con
   * `sendClaimInvitation`, el dueño recibe un correo para reclamarla (vence en 30 días; la clínica conserva el acceso).
   * La respuesta se lee con tolerancia: `petId` (o `id`) y los datos de la invitación si vienen.
   */
  registerPatient(veterinaryId: string, body: NewPatientBody): Observable<RegisteredPatientDto> {
    return this.http.post<RegisteredPatientDto>(`${VET_API}/${veterinaryId}/patients/walk-in`, body).pipe(mapApiError());
  }

  /** "Reenviar invitación": cancela las pendientes y crea una nueva de 30 días. Solo si la mascota sigue sin reclamar. */
  resendClaimInvitation(veterinaryId: string, petId: string): Observable<{ invitationEmail?: string | null; expiresAt?: string | null } | null> {
    return this.http.post<{ invitationEmail?: string | null; expiresAt?: string | null } | null>(`${VET_API}/${veterinaryId}/patients/${petId}/claim-invitation`, {}).pipe(mapApiError());
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
