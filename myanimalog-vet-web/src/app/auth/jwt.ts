/** Claims que nos interesan del JWT (solo para mostrar; la seguridad la hace el backend). */
export interface JwtClaims {
  sub?: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
  platform_role?: 'USER' | 'PLATFORM_ADMIN';
  ctx?: string;
  vet_id?: string;
  vet_role?: string;
  exp?: number;
}

/** Lee el cuerpo del JWT sin validar la firma. Devuelve `{}` si el token no se puede leer. */
export function decodeJwt(token: string | null | undefined): JwtClaims {
  if (!token) return {};
  try {
    const part = token.split('.')[1] ?? '';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return {};
  }
}
