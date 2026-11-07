import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { STATUS_PATH, StepId, stepInfo } from '@services/register/models/registration.model';
import { SessionService } from '@auth/services/session.service';
import { RegistrationStore } from '@services/register/registration.store';

/**
 * Impide saltarse pasos del registro: si faltan pasos anteriores, lleva al primero pendiente.
 * Si la solicitud ya se envió, el único destino válido es la pantalla de estado.
 */
export function stepGuard(step: StepId): CanActivateFn {
  return () => {
    const store = inject(RegistrationStore);
    const router = inject(Router);
    if (store.submitted()) return router.createUrlTree(['/registro', STATUS_PATH]);
    return store.canEnter(step)
      ? true
      : router.createUrlTree(['/registro', stepInfo(store.firstOpenStep()).path]);
  };
}

/**
 * La pantalla de estado existe después de enviar la solicitud, para quien ya trabaja con una clínica,
 * o con `?clinica=<id>` (una clínica rechazada o en corrección no tiene token de clínica: se consulta con el normal).
 */
export const statusGuard: CanActivateFn = (route) => {
  const store = inject(RegistrationStore);
  const session = inject(SessionService);
  const byQuery = session.isAuthenticated() && !!route.queryParamMap.get('clinica');
  return store.submitted() || session.hasClinic() || byQuery ? true : inject(Router).createUrlTree(['/registro']);
};
