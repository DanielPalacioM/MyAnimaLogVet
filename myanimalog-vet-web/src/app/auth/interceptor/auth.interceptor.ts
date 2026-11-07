import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { API_ORIGINS, AUTH_API, PUBLIC_ENDPOINTS, usesNormalToken } from '../auth.config';
import { SessionService } from '../services/session.service';
import { TokenService } from '../services/token.service';

/** Marca el reintento: si falla otra vez con 401 no se vuelve a renovar (evita ciclos). */
const RETRIED = new HttpContextToken<boolean>(() => false);

/** Códigos 403 que significan "esta clínica ya no es tuya": hay que volver a elegir. */
const LOST_CLINIC = new Set(['NOT_CLINIC_MEMBER', 'TENANT_MISMATCH', 'CLINIC_CONTEXT_REQUIRED']);

/** Una sola renovación a la vez: si varias peticiones reciben 401, comparten el mismo refresh. */
let refreshInFlight$: Observable<string> | null = null;

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

const isApi = (url: string) => API_ORIGINS.some((origin) => url.startsWith(origin));
const isPublic = (url: string) => PUBLIC_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));

/**
 * Pone el token en cada petición a la API: el **normal** para el selector de clínicas, el perfil propio,
 * las invitaciones y la administración; el **de clínica** para todo lo demás.
 * Ante un 401 renueva el token normal una sola vez (el refresh rota: se guarda el par nuevo), vuelve a pedir
 * el token de clínica si hacía falta y reintenta. Si no se puede renovar, cierra la sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenService);
  const session = inject(SessionService);
  const http = inject(HttpClient);
  const router = inject(Router);

  if (!isApi(req.url) || isPublic(req.url)) return next(req);

  const normal = usesNormalToken(req.url);
  const tokenFor = () => (normal ? tokens.accessToken() : (tokens.clinicToken() ?? tokens.accessToken()));

  const refresh = (): Observable<string> => {
    const refreshToken = tokens.refreshToken();
    if (!refreshToken) return throwError(() => new Error('Sin refresh token'));
    refreshInFlight$ ??= http
      .post<{ token?: string; accessToken?: string; refreshToken: string }>(`${AUTH_API}/refresh`, { refreshToken })
      .pipe(
        // La doc del cliente dice `accessToken`; se acepta también `token`.
        map((res) => ({ accessToken: (res.accessToken ?? res.token)!, refreshToken: res.refreshToken })),
        tap((pair) => tokens.save(pair)),
        map((pair) => pair.accessToken),
        finalize(() => (refreshInFlight$ = null)),
        shareReplay(1),
      );
    return refreshInFlight$;
  };

  /** Después de renovar el token normal, el de clínica también hay que pedirlo de nuevo. */
  const reissueClinic = (access: string): Observable<string> => {
    const clinicId = tokens.clinicId();
    if (normal || !clinicId) return of(access);
    return http
      .post<{ accessToken?: string; token?: string }>(`${AUTH_API}/context/veterinary/${clinicId}`, {}, {
        headers: { Authorization: `Bearer ${access}` },
        context: new HttpContext().set(RETRIED, true),
      })
      .pipe(
        map((res) => res.accessToken ?? res.token ?? ''),
        tap((token) => token && tokens.saveClinic(token, clinicId)),
      );
  };

  return next(withToken(req, tokenFor())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      if (error.status === 403 && LOST_CLINIC.has((error.error as { code?: string } | null)?.code ?? '')) {
        tokens.clearClinic();
        session.selectClinic(null);
        void router.navigateByUrl('/elegir-clinica');
        return throwError(() => error);
      }

      if (error.status !== 401 || req.context.get(RETRIED) || !tokens.refreshToken()) return throwError(() => error);

      return refresh().pipe(
        switchMap((access) => reissueClinic(access)),
        switchMap(() => retry(req, next, tokenFor())),
        catchError((refreshError: unknown) => {
          session.signOut();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

const retry = (req: HttpRequest<unknown>, next: HttpHandlerFn, token: string | null) =>
  next(withToken(req.clone({ context: req.context.set(RETRIED, true) }), token));
