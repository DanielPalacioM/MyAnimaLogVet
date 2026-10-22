import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { STATUS_PATH, StepId, stepInfo } from '@services/register/models/registration.model';
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

/** La pantalla de estado solo existe después de enviar la solicitud. */
export const statusGuard: CanActivateFn = () => {
  const store = inject(RegistrationStore);
  return store.submitted() ? true : inject(Router).createUrlTree(['/registro']);
};
