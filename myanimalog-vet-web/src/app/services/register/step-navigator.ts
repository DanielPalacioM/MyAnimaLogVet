import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { StepId, STATUS_PATH, STEPS, stepInfo } from '@services/register/models/registration.model';
import { RegistrationStore } from './registration.store';

/** Navegación entre los pasos del registro. Soporta "Editar" desde el resumen (vuelve a Revisar al terminar). */
@Injectable()
export class StepNavigator {
  private readonly router = inject(Router);
  private readonly store = inject(RegistrationStore);

  go(step: StepId): void {
    void this.router.navigate(['/registro', stepInfo(step).path]);
  }

  goToStatus(): void {
    void this.router.navigate(['/registro', STATUS_PATH]);
  }

  /** Abre un paso desde el resumen; al continuar, regresa a Revisar. */
  edit(step: StepId): void {
    void this.router.navigate(['/registro', stepInfo(step).path], { queryParams: { volver: 'revisar' } });
  }

  next(from: StepId): void {
    if (this.returningToReview() && this.store.canEnter('review')) {
      this.go('review');
      return;
    }
    const index = STEPS.findIndex((s) => s.id === from);
    this.go(STEPS[Math.min(index + 1, STEPS.length - 1)].id);
  }

  back(from: StepId): void {
    if (this.returningToReview()) {
      this.go('review');
      return;
    }
    const index = STEPS.findIndex((s) => s.id === from);
    // Desde "Tu clínica" no se vuelve a la verificación del correo (ya está hecha): se vuelve a la cuenta.
    const previous = STEPS[Math.max(index - 1, 0)].id;
    this.go(previous === 'verify' ? 'account' : previous);
  }

  private returningToReview(): boolean {
    return this.router.parseUrl(this.router.url).queryParams['volver'] === 'revisar';
  }
}
