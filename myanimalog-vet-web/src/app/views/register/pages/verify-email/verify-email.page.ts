import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { errorMessage } from '@services/api-error';
import { RegisterService } from '@services/register/register.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';

const CODE_LENGTH = 6;

/**
 * Container: "Verifica tu correo antes de registrar" (Figma 2035:313).
 * El backend exige `email_verified = true` para registrar la clínica (REGISTRO §2).
 */
@Component({
  selector: 'vet-verify-email-page',
  standalone: false,
  templateUrl: './verify-email.page.html',
  styleUrl: './verify-email.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage implements OnInit {
  private readonly api = inject(RegisterService);
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly email = this.store.draft().account.email;
  protected readonly codeLength = CODE_LENGTH;
  protected readonly code = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly secondsLeft = signal(45);
  protected readonly canResend = computed(() => this.secondsLeft() === 0);

  ngOnInit(): void {
    // Si ya estaba verificado (volvió con "Atrás"), no lo hacemos repetir el paso.
    if (this.store.draft().flags.emailVerified) {
      this.nav.next('verify');
      return;
    }
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.secondsLeft.update((s) => Math.max(0, s - 1)));
  }

  protected verify(): void {
    if (this.code().length < CODE_LENGTH) {
      this.error.set(`Escribe los ${CODE_LENGTH} dígitos del código.`);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.verifyEmail(this.email, this.code()).subscribe({
      next: () => {
        this.store.setFlags({ emailVerified: true });
        this.nav.next('verify');
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos verificar el código. Inténtalo de nuevo.'));
        this.loading.set(false);
      },
    });
  }

  protected resend(): void {
    if (!this.canResend()) return;
    this.error.set(null);
    this.api.sendVerificationCode(this.email).subscribe({
      next: ({ resendAfterSeconds }) => {
        this.code.set('');
        this.secondsLeft.set(resendAfterSeconds);
        this.notice.set('Te enviamos un código nuevo.');
      },
      error: (e: unknown) => this.error.set(errorMessage(e, 'No pudimos reenviar el código.')),
    });
  }
}
