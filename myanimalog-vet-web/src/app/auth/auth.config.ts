import { environment } from '@env/environment';

/** User service: login, refresh y token de clínica. */
export const USER_API = environment.userApiUrl;
export const AUTH_API = `${USER_API}/auth`;

/** veterinary-service (o gateway). */
export const VET_ORIGIN = environment.vetApiUrl;
export const VET_API = `${VET_ORIGIN}/api/veterinary`;

/** Peticiones a estos orígenes llevan el token; nunca las de otros. */
export const API_ORIGINS: readonly string[] = [USER_API, VET_ORIGIN].filter((o, i, all) => all.indexOf(o) === i);

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

export const usesNormalToken = (url: string): boolean => {
  const path = url.split('?')[0];
  return path.startsWith(`${AUTH_API}/`) || NORMAL_EXACT.includes(path) || NORMAL_PREFIX.some((p) => path.startsWith(p));
};
