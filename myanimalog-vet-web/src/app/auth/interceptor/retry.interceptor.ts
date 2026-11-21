import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';
import { API_ORIGINS } from '../auth.config';

const RETRIES = 3;
const DELAYS_MS = [300, 800, 1600];

/**
 * ¿Es un corte de conexión y no una respuesta del backend?
 * Sin estado (0), 502/503/504, o un 500 sin cuerpo JSON: el proxy de desarrollo responde así cuando
 * Cloud Run cierra la conexión ("socket hang up"). Un 500 real del backend trae un cuerpo y no se repite.
 */
const isTransient = (e: unknown): boolean => {
  if (!(e instanceof HttpErrorResponse)) return false;
  if (e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504) return true;
  return e.status === 500 && (e.error == null || typeof e.error === 'string') && !String(e.error ?? '').trim();
};

/**
 * Repite hasta 3 veces las lecturas (GET/HEAD) que se cortan por la conexión, con espera creciente.
 * Solo lecturas: repetir una escritura podría duplicarla. Va antes del interceptor de autenticación.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const idempotent = req.method === 'GET' || req.method === 'HEAD';
  const isApi = req.url.startsWith('/') || API_ORIGINS.some((origin) => req.url.startsWith(origin));
  if (!idempotent || !isApi) return next(req);
  return next(req).pipe(
    retry({
      count: RETRIES,
      delay: (error, attempt) => (isTransient(error) ? timer(DELAYS_MS[Math.min(attempt - 1, DELAYS_MS.length - 1)]) : throwError(() => error)),
    }),
  );
};
