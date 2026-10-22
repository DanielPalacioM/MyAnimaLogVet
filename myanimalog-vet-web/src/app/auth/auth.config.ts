/** Prefijo del gateway para el servicio de usuarios. TODO: confirmar la ruta final con el backend. */
export const AUTH_API = '/api/auth';

/** Solo las peticiones a la API (relativas al gateway) llevan el token; nunca las de otros orígenes. */
export const API_PREFIX = '/api/';

/** Endpoints que no llevan token ni reintentan con refresh. */
export const PUBLIC_ENDPOINTS: readonly string[] = [
  `${AUTH_API}/local`,
  `${AUTH_API}/refresh`,
  `${AUTH_API}/verify-email`,
];
