import { environment } from '@env/environment';

/** User service: login, refresh y token de clínica. */
export const USER_API = environment.userApiUrl;
export const AUTH_API = `${USER_API}/auth`;

/** veterinary-service (o gateway). */
export const VET_ORIGIN = environment.vetApiUrl;
export const VET_API = `${VET_ORIGIN}/api/veterinary`;

/** calendar-service: citas de la clínica (token de clínica). Incluye `/api`. */
export const CALENDAR_API = environment.calendarApiUrl;

/** Peticiones a estos orígenes llevan el token; nunca las de otros. */
export const API_ORIGINS: readonly string[] = [USER_API, VET_ORIGIN, CALENDAR_API].filter((o, i, all) => all.indexOf(o) === i);

/** Endpoints que no llevan token ni reintentan con refresh. */
export const PUBLIC_ENDPOINTS: readonly string[] = [
  `${AUTH_API}/local`,
  `${AUTH_API}/refresh`,
  `${AUTH_API}/verify-email`,
  `${AUTH_API}/google`,
  `${AUTH_API}/verify-email/resend`,
  `${USER_API}/user/register`,
];

/**
 * Rutas del veterinary-service que se llaman con el **token normal** (el del usuario, sin clínica):
 * el selector de clínicas, el registro, el perfil profesional propio, las invitaciones del invitado,
 * vincularse como cliente y todo el panel de administración de la plataforma.
 * El resto usa el token de clínica.
 */
const NORMAL_EXACT = [`${VET_API}/me`, `${VET_API}/register`];
const NORMAL_PREFIX = [`${VET_API}/me/`, `${VET_API}/invitations/`, `${VET_API}/link/`, `${VET_API}/admin/`];

/**
 * Calendar: el catálogo reservable (`/veterinaries/{id}/services`) es una ruta de **dueño**: con token de clínica
 * responde `403 OWNER_TOKEN_REQUIRED`. El panel lo pide con el token normal de la persona.
 */
const CALENDAR_OWNER_ROUTE = /^\/veterinaries\/[^/]+\/services$/;

export const usesNormalToken = (url: string): boolean => {
  const path = url.split('?')[0];
  if (path.startsWith(CALENDAR_API) && CALENDAR_OWNER_ROUTE.test(path.slice(CALENDAR_API.length))) return true;
  return path.startsWith(`${AUTH_API}/`) || NORMAL_EXACT.includes(path) || NORMAL_PREFIX.some((p) => path.startsWith(p));
};
