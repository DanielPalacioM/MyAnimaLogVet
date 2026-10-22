import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiError, errorMessage } from '@services/api-error';
import { switchMap } from 'rxjs';
import { RegisterService } from '@services/register/register.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { EMAIL_PATTERN, fullNameValidator, passwordValidator } from '@shared/validators/common';

/** Container: Paso 1 · Crea tu cuenta (Figma 1899:73). Crea la cuenta y envía el código al correo. */
@Component({
  selector: 'vet-account-page',
  standalone: false,
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  private readonly api = inject(RegisterService);
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly emailTaken = signal(false);
  protected readonly showPassword = signal(false);
  /** Si la cuenta ya se creó (el usuario volvió con "Atrás"), el paso queda en solo lectura. */
  protected readonly accountCreated = this.store.draft().flags.accountCreated;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: [this.store.draft().account.fullName, [Validators.required, fullNameValidator]],
    email: [this.store.draft().account.email, [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', [Validators.required, passwordValidator]],
  });
  protected readonly emailMessages = { pattern: 'Escribe un correo válido, por ejemplo tucorreo@clinica.com.' };

  constructor() {
    if (this.accountCreated) this.form.disable();
  }

  protected submit(): void {
    if (this.accountCreated) {
      this.nav.next('account');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fullName, email, password } = this.form.getRawValue();
    const account = { fullName: fullName.trim(), email: email.trim().toLowerCase() };

    this.loading.set(true);
    this.error.set(null);
    this.emailTaken.set(false);
    this.api
      .createAccount({ ...account, password })
      .pipe(switchMap(() => this.api.sendVerificationCode(account.email)))
      .subscribe({
        next: () => {
          this.store.patch('account', account);
          this.store.setFlags({ accountCreated: true });
          this.nav.next('account');
        },
        error: (e: unknown) => {
          this.emailTaken.set(e instanceof ApiError && e.code === 'EMAIL_TAKEN');
          this.error.set(errorMessage(e, 'No pudimos crear tu cuenta. Inténtalo de nuevo.'));
          this.loading.set(false);
        },
      });
  }
}
