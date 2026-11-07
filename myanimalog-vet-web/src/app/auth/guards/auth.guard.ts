import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/** Sin sesión lleva al login y, al entrar, de vuelta a donde iba (p. ej. el enlace de una invitación). */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(SessionService).isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : {} });

/** Configuración de la clínica (Mi clínica, Plan, Reportes): solo el dueño y los administradores. */
export const managerGuard: CanActivateFn = () => (inject(SessionService).isManager() ? true : inject(Router).createUrlTree(['/inicio']));

/** Las pantallas de administración son solo del equipo de MyAnimaLog (`PLATFORM_ADMIN`). */
export const platformAdminGuard: CanActivateFn = () =>
  inject(SessionService).isPlatformAdmin() ? true : inject(Router).createUrlTree(['/']);

/** El panel necesita una clínica elegida (token de clínica): si no, al selector. */
export const clinicGuard: CanActivateFn = () =>
  inject(SessionService).hasClinic() ? true : inject(Router).createUrlTree(['/elegir-clinica']);
