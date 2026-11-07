import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { Observable } from 'rxjs';
import { mapApiError } from '../api-error';
import { ClinicDataPatch, ClinicProfileDto, ClinicSettingsPatch, InviteCodeDto, SubscriptionDto } from './api.models';

/** Perfil, configuración, logo, código de vinculación y plan de la clínica (token de clínica). */
@Injectable({ providedIn: 'root' })
export class ClinicApi {
  private readonly http = inject(HttpClient);
  private readonly base = (id: string) => `${VET_API}/${id}`;

  profile(id: string): Observable<ClinicProfileDto> {
    return this.http.get<ClinicProfileDto>(this.base(id)).pipe(mapApiError());
  }

  updateData(id: string, patch: ClinicDataPatch): Observable<Partial<ClinicProfileDto>> {
    return this.http.patch<Partial<ClinicProfileDto>>(this.base(id), patch).pipe(mapApiError());
  }

  updateSettings(id: string, patch: ClinicSettingsPatch): Observable<Partial<ClinicProfileDto>> {
    return this.http.patch<Partial<ClinicProfileDto>>(`${this.base(id)}/settings`, patch).pipe(mapApiError());
  }

  uploadLogo(id: string, file: File): Observable<{ logoUrl: string | null }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<{ logoUrl: string | null }>(`${this.base(id)}/logo`, form).pipe(mapApiError());
  }

  deleteLogo(id: string): Observable<{ logoUrl: string | null }> {
    return this.http.delete<{ logoUrl: string | null }>(`${this.base(id)}/logo`).pipe(mapApiError());
  }

  /** Código `VET-XXXXXXXX` con el que los dueños de mascotas se vinculan (no es el de invitar personal). */
  generateInviteCode(id: string): Observable<InviteCodeDto> {
    return this.http.post<InviteCodeDto>(`${this.base(id)}/invite-code`, {}).pipe(mapApiError());
  }

  deleteInviteCode(id: string): Observable<InviteCodeDto> {
    return this.http.delete<InviteCodeDto>(`${this.base(id)}/invite-code`).pipe(mapApiError());
  }

  /** ¿Ya venció el plan actual? (`GET /{id}/subscription/is-expired`). */
  isSubscriptionExpired(id: string): Observable<{ expired: boolean; endDate: string | null }> {
    return this.http.get<{ expired: boolean; endDate: string | null }>(`${this.base(id)}/subscription/is-expired`).pipe(mapApiError());
  }

  /** `404 NO_ACTIVE_SUBSCRIPTION` si no hay plan activo. */
  activeSubscription(id: string): Observable<SubscriptionDto> {
    return this.http.get<SubscriptionDto>(`${this.base(id)}/subscription/active`).pipe(mapApiError());
  }
}
