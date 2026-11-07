import { ClinicRole } from './models/session.models';

/**
 * Roles que pueden configurar la clínica y gestionar al equipo (`CLINIC_CONFIGURE` en el backend):
 * el dueño (veterinario principal) y los administradores.
 */
export const MANAGER_ROLES: readonly ClinicRole[] = ['OWNER', 'ADMIN'];

/**
 * ¿Este rol gestiona la clínica? Si todavía no se conoce el rol (sesión antigua) se deja pasar:
 * el backend es quien decide de verdad y responde 403 si no corresponde.
 */
export const isManager = (role: ClinicRole | null | undefined): boolean => !role || MANAGER_ROLES.includes(role);

export const MANAGER_ONLY_MESSAGE = 'Solo el dueño o un administrador de la clínica puede hacer esto.';
