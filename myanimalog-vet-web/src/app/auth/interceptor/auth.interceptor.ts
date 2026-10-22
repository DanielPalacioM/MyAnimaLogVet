import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { API_PREFIX, AUTH_API, PUBLIC_ENDPOINTS } from '../auth.config';
import { TokenService } from '../services/token.service';

/** Una sola renovación a la vez: si varias peticiones reciben 401, comparten el mismo refresh. */
let refreshInFlight$: Observable<string> | null = null;

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

const isPublic = (url: string) => PUBLIC_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));

/**
 * Pasa el token en cada petición a la API y, ante un 401, llama a `POST /auth/refresh` una sola vez,
 * guarda el par nuevo (el refresh rota) y reintenta la petición original. Si el refresh falla, cierra la sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenService);
  const http = inject(HttpClient);
  const router = inject(Router);

  if (!req.url.startsWith(API_PREFIX) || isPublic(req.url)) return next(req);

  const refresh = (): Observable<string> => {
    const refreshToken = tokens.refreshToken();
    if (!refreshToken) return throwError(() => new Error('Sin refresh token'));
    refreshInFlight$ ??= http
      .post<{ token?: string; accessToken?: string; refreshToken: string }>(`${AUTH_API}/refresh`, { refreshToken })
      .pipe(
        // El backend de hoy responde `token`; la doc del cliente dice `accessToken`: se aceptan ambos.
        map((res) => ({ accessToken: (res.accessToken ?? res.token)!, refreshToken: res.refreshToken })),
        tap((pair) => tokens.save(pair)),
        map((pair) => pair.accessToken),
        finalize(() => (refreshInFlight$ = null)),
        shareReplay(1),
      );
    return refreshInFlight$;
  };

  return next(withToken(req, tokens.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !tokens.refreshToken()) {
        return throwError(() => error);
      }
      return refresh().pipe(
        switchMap((token) => retry(req, next, token)),
        catchError((refreshError: unknown) => {
          tokens.clear();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

const retry = (req: HttpRequest<unknown>, next: HttpHandlerFn, token: string) => next(withToken(req, token));
