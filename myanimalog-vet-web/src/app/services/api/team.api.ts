import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { VET_API } from '@auth/auth.config';
import { map, Observable } from 'rxjs';
import { mapApiError } from '../api-error';
import {
  ColleagueProfileDto,
  EmployeeDto,
  InvitableRole,
  InvitationAcceptedDto,
  InvitationDto,
  InvitationPreviewDto,
  InvitationStatusDto,
  MyInvitationDto,
  OwnershipTransferDto,
} from './api.models';

/** Equipo e invitaciones. Lado de la clínica: token de clínica. Lado del invitado: token normal. */
@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);
  private readonly base = (id: string) => `${VET_API}/${id}`;

  // ---- Equipo ----

  employees(id: string, includeInactive = true): Observable<EmployeeDto[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<{ employees: EmployeeDto[] }>(`${this.base(id)}/employees`, { params }).pipe(
      map((res) => res.employees ?? []),
      mapApiError(),
    );
  }

  /** Vista reducida del perfil profesional de un colega. `404` si no tiene perfil. */
  colleagueProfile(id: string, employeeId: string): Observable<ColleagueProfileDto> {
    return this.http.get<ColleagueProfileDto>(`${this.base(id)}/employees/${employeeId}/professional-profile`).pipe(mapApiError());
  }

  changeRole(id: string, employeeId: string, role: InvitableRole): Observable<void> {
    return this.http.patch<unknown>(`${this.base(id)}/employees/${employeeId}/role`, { role }).pipe(map(() => undefined), mapApiError());
  }

  /** Retira al empleado (no borra: queda inactivo). */
  removeEmployee(id: string, employeeId: string): Observable<void> {
    return this.http.delete<unknown>(`${this.base(id)}/employees/${employeeId}`).pipe(map(() => undefined), mapApiError());
  }

  leave(id: string): Observable<void> {
    return this.http.post<unknown>(`${this.base(id)}/leave`, {}).pipe(map(() => undefined), mapApiError());
  }

  transferOwnership(id: string, newOwnerEmployeeId: string): Observable<OwnershipTransferDto> {
    return this.http.post<OwnershipTransferDto>(`${this.base(id)}/ownership-transfer`, { newOwnerEmployeeId }).pipe(mapApiError());
  }

  // ---- Invitaciones (clínica) ----

  invitations(id: string, status: InvitationStatusDto = 'PENDING'): Observable<InvitationDto[]> {
    const params = new HttpParams().set('status', status);
    return this.http.get<{ invitations: InvitationDto[] }>(`${this.base(id)}/invitations`, { params }).pipe(
      map((res) => res.invitations ?? []),
      mapApiError(),
    );
  }

  invite(id: string, email: string, role: InvitableRole): Observable<InvitationDto> {
    return this.http.post<{ invitation: InvitationDto }>(`${this.base(id)}/invitations`, { email, role }).pipe(map((res) => res.invitation), mapApiError());
  }

  resend(id: string, invitationId: string): Observable<InvitationDto> {
    return this.http.post<{ invitation: InvitationDto }>(`${this.base(id)}/invitations/${invitationId}/resend`, {}).pipe(map((res) => res.invitation), mapApiError());
  }

  revoke(id: string, invitationId: string): Observable<InvitationDto> {
    return this.http.delete<{ invitation: InvitationDto }>(`${this.base(id)}/invitations/${invitationId}`).pipe(map((res) => res.invitation), mapApiError());
  }

  // ---- Invitaciones (invitado, token normal) ----

  myInvitations(): Observable<MyInvitationDto[]> {
    return this.http.get<{ invitations: MyInvitationDto[] }>(`${VET_API}/me/invitations`).pipe(map((res) => res.invitations ?? []), mapApiError());
  }

  /** El token de la invitación va en el cuerpo, nunca en la URL. */
  previewInvitation(token: string): Observable<InvitationPreviewDto> {
    return this.http.post<InvitationPreviewDto>(`${VET_API}/invitations/preview`, { token }).pipe(mapApiError());
  }

  acceptInvitation(token: string): Observable<InvitationAcceptedDto> {
    return this.http.post<InvitationAcceptedDto>(`${VET_API}/invitations/accept`, { token }).pipe(mapApiError());
  }

  declineInvitation(token: string): Observable<void> {
    return this.http.post<unknown>(`${VET_API}/invitations/decline`, { token }).pipe(map(() => undefined), mapApiError());
  }
}
