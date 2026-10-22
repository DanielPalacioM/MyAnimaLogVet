import { Observable, of, throwError, timer } from 'rxjs';
import { delay, switchMap } from 'rxjs/operators';
import { ApiError } from '../api-error';

/** Latencia simulada de la API mock (ms), para ver estados de carga. */
export const MOCK_LATENCY_MS = 400;

export function mockResponse<T>(data: T, latency = MOCK_LATENCY_MS): Observable<T> {
  return of(data).pipe(delay(latency));
}

/** Respuesta fallida del mock: espera la latencia simulada y luego lanza el error. */
export function mockFailure(code: string, message: string, latency = MOCK_LATENCY_MS): Observable<never> {
  return timer(latency).pipe(switchMap(() => throwError(() => new ApiError(code, message))));
}
