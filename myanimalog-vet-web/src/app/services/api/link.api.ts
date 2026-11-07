import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { Observable } from 'rxjs';
import { mapApiError } from '../api-error';

export interface ClientLink {
  id: string;
  userId: string;
  veterinaryId: string;
  status: 'LINKED';
  linkedAt: string;
}

/**
 * Vínculo entre un dueño de mascotas y una clínica (Postman, carpeta 11).
 * Vincularse (`code`/`url`) lo hace el dueño desde su app, con su token normal. Desvincular lo puede hacer el propio
 * cliente (token normal) o la clínica con `CLINIC_CONFIGURE` (token de clínica): la ruta es la misma.
 * El panel todavía no tiene una lista de clientes que consumir, así que "Quitar cliente" queda sin pantalla.
 */
@Injectable({ providedIn: 'root' })
export class LinkApi {
  private readonly http = inject(HttpClient);

  linkByCode(code: string): Observable<ClientLink> {
    return this.http.post<ClientLink>(`${VET_API}/link/code`, { code }).pipe(mapApiError());
  }

  linkByUrl(url: string): Observable<ClientLink> {
    return this.http.post<ClientLink>(`${VET_API}/link/url`, { url }).pipe(mapApiError());
  }

  /** `404 USER_NOT_LINKED` si no había vínculo; `403 INSUFFICIENT_PERMISSION` si no corresponde. */
  unlink(veterinaryId: string, clientUserId: string): Observable<void> {
    return this.http.delete<void>(`${VET_API}/link/${veterinaryId}/user/${clientUserId}`).pipe(mapApiError());
  }
}
