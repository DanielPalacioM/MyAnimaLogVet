import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, tap } from 'rxjs';
import { mapApiError } from '@services/api-error';
import { AUTH_API, VET_API } from '../auth.config';
import { AccountClinic, ClinicSummary } from '../models/session.models';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

/** `GET /me` devuelve `name`; el resto de la app usa `veterinaryName`. */
type MeClinic = Omit<ClinicSummary, 'veterinaryName'> & { name?: string; veterinaryName?: string };

interface MeResponse {
  veterinaries?: MeClinic[];
}

/**
 * Selector de clínica: lista las clínicas de la persona (`GET /me`, token normal) y, al elegir una,
 * pide el **token de clínica** (`POST /auth/context/veterinary/{id}`).
 */
@Injectable({ providedIn: 'root' })
export class ClinicContextService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly session = inject(SessionService);

  /** Clínicas donde la persona es empleada activa. Las guarda en la sesión. */
  loadClinics(): Observable<ClinicSummary[]> {
    return this.http.get<MeResponse | MeClinic[]>(`${VET_API}/me`).pipe(
      map((res) => (Array.isArray(res) ? res : (res.veterinaries ?? []))),
      map((list): ClinicSummary[] => list.map(({ name, veterinaryName, ...rest }) => ({ ...rest, veterinaryName: name ?? veterinaryName ?? '' }))),
      tap((list) => this.session.setClinics(list)),
      mapApiError(),
    );
  }

  /** Entra a la clínica: pide el token de clínica y la deja como actual. */
  enter(clinic: ClinicSummary): Observable<AccountClinic> {
    return this.http.post<{ accessToken?: string; token?: string }>(`${AUTH_API}/context/veterinary/${clinic.veterinaryId}`, {}).pipe(
      map((res) => res.accessToken ?? res.token ?? ''),
      tap((token) => {
        if (!token) throw new Error('El servidor no devolvió el token de clínica.');
        this.tokens.saveClinic(token, clinic.veterinaryId);
        this.session.selectClinic(clinic);
      }),
      map(() => clinic),
      mapApiError(),
    );
  }

  /** Carga las clínicas y entra directo si solo hay una. Devuelve la elegida o `null` si hay que elegir. */
  loadAndAutoEnter(): Observable<{ clinics: ClinicSummary[]; entered: AccountClinic | null }> {
    return this.loadClinics().pipe(
      switchMap((clinics) =>
        clinics.length === 1
          ? this.enter(clinics[0]).pipe(map((entered) => ({ clinics, entered })))
          : [{ clinics, entered: null as AccountClinic | null }],
      ),
    );
  }

  /** Sale de la clínica actual (vuelve al selector). */
  leave(): void {
    this.tokens.clearClinic();
    this.session.selectClinic(null);
  }
}
