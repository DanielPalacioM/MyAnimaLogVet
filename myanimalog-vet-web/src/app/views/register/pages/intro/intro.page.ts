import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SessionService } from '@auth/services/session.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';

/**
 * Container: "Antes de empezar" (Figma 1861:19). Aviso de tratamiento de datos (Ley 1581 de 2012,
 * análisis con IA) y dos casillas obligatorias antes de crear la cuenta.
 */
@Component({
  selector: 'vet-intro-page',
  standalone: false,
  templateUrl: './intro.page.html',
  styleUrl: './intro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntroPage {
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly session = inject(SessionService);

  protected readonly attempted = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    dataPolicy: [this.store.draft().consent.dataPolicy, Validators.requiredTrue],
    terms: [this.store.draft().consent.terms, Validators.requiredTrue],
  });

  protected start(): void {
    this.attempted.set(true);
    if (this.form.invalid) return;
    this.store.patch('consent', this.form.getRawValue());
    // Quien ya tiene cuenta (registra otra clínica) no repite la cuenta ni la verificación del correo.
    const user = this.session.user();
    if (this.session.isAuthenticated() && user) {
      this.store.patch('account', { fullName: user.fullName, email: user.email });
      this.store.setFlags({ accountCreated: true, emailVerified: true });
      this.nav.go('clinic');
      return;
    }
    this.nav.next('consent');
  }
}
