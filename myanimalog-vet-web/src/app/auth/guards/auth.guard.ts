import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/** Protege el panel: sin sesión lleva al login. */
export const authGuard: CanActivateFn = () =>
  inject(SessionService).isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
