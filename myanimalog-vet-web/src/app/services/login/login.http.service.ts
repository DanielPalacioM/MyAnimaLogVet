import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AUTH_API } from '@auth/auth.config';
import { decodeJwt } from '@auth/jwt';
import { AccountUser } from '@auth/models/session.models';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { SessionService } from '@auth/services/session.service';
import { TokenService } from '@auth/services/token.service';
import { catchError, map, Observable, switchMap, tap, throwError } from 'rxjs';
import { ApiError, toApiError } from '../api-error';
import { LoginCredentials, LoginResult } from './login.models';
import { LoginService } from './login.service';

interface LoginResponse {
  accessToken?: string;
  token?: string;
  refreshToken: string;
  expiresIn?: number;
}

/** Login real: `POST /auth/local` → tokens → `GET /me` (clínicas) → si hay una sola, token de clínica. */
@Injectable()
export class LoginHttpService extends LoginService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly session = inject(SessionService);
  private readonly context = inject(ClinicContextService);

  login({ email, password }: LoginCredentials): Observable<LoginResult> {
    return this.http.post<LoginResponse>(`${AUTH_API}/local`, { email: email.trim(), password }).pipe(
      catchError((e: unknown) => throwError(() => this.loginError(e))),
      switchMap((res) => this.finish(res, email)),
    );
  }

  loginWithGoogle(idToken: string): Observable<LoginResult> {
    return this.http.post<LoginResponse>(`${AUTH_API}/google`, { idToken }).pipe(
      catchError((e: unknown) => throwError(() => this.googleError(e))),
      switchMap((res) => this.finish(res, '')),
    );
  }

  /** Con los tokens ya entregados: guarda la sesión, trae las clínicas y, si hay una sola, entra a ella. */
  private finish(res: LoginResponse, email: string): Observable<LoginResult> {
    const access = (res.accessToken ?? res.token)!;
    this.tokens.save({ accessToken: access, refreshToken: res.refreshToken }, false);
    this.session.signIn(this.userFrom(access, email), []);
    return this.context.loadAndAutoEnter().pipe(
      map(({ clinics }) => ({ user: this.session.user()!, clinics })),
      catchError((e: unknown) => {
        // Si falló después de entrar (p. ej. /me), no dejar una sesión a medias.
        this.session.signOut();
        return throwError(() => toApiError(e));
      }),
    );
  }

  private googleError(e: unknown): ApiError {
    if (e instanceof HttpErrorResponse && [400, 401, 403].includes(e.status)) {
      return new ApiError('GOOGLE_REJECTED', 'No pudimos validar tu cuenta de Google. Inténtalo de nuevo o ingresa con tu correo.', e.status);
    }
    return toApiError(e);
  }

  private userFrom(accessToken: string, email: string): AccountUser {
    const claims = decodeJwt(accessToken);
    const mail = claims.email ?? email.trim().toLowerCase();
    return {
      userId: claims.sub ?? mail,
      fullName: claims.name ?? nameFromEmail(mail),
      email: mail,
      clinic: null,
      platformRole: claims.platform_role ?? 'USER',
    };
  }

  /** El login falla con 401 si las credenciales no sirven; el resto se traduce por código. */
  private loginError(e: unknown): ApiError {
    if (e instanceof HttpErrorResponse) {
      const code = (e.error as { code?: string } | null)?.code;
      if (code === 'EMAIL_NOT_VERIFIED' || (e.status === 403 && !code)) return new ApiError('EMAIL_NOT_VERIFIED', 'Verifica tu correo antes de entrar.', e.status);
      if (e.status === 400 || e.status === 401 || e.status === 404) return new ApiError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.', e.status);
    }
    return toApiError(e);
  }
}

/** "ana.gomez@correo.com" → "Ana Gomez". Solo hasta que el equipo trae el nombre real. */
export function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
