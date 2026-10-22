import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@auth/services/session.service';
import { TokenService } from '@auth/services/token.service';
import { LoginCredentials } from '@services/login/login.models';
import { LoginService } from '@services/login/login.service';
import { errorMessage } from '@services/api-error';
import { AccountUser } from '@services/mock/mock-directory';
import { RegistrationStore } from '@services/register/registration.store';

/** Página del login (Figma 1828:2): llama al servicio, guarda los tokens y decide a dónde ir. */
@Component({
  selector: 'vet-login-page',
  standalone: false,
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly api = inject(LoginService);
  private readonly tokens = inject(TokenService);
  private readonly session = inject(SessionService);
  private readonly registration = inject(RegistrationStore);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected signIn(credentials: LoginCredentials): void {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.api.login(credentials).subscribe({
      next: ({ tokens, user }) => {
        this.tokens.save(tokens);
        this.session.signIn(user);
        this.loading.set(false);
        this.goNext(user);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos iniciar sesión. Inténtalo de nuevo.'));
        this.loading.set(false);
      },
    });
  }

  /** Sin clínica → registro. En revisión → su pantalla de estado. Aprobada → panel. */
  private goNext(user: AccountUser): void {
    const clinic = user.clinic;
    if (!clinic) {
      void this.router.navigateByUrl('/registro');
    } else if (clinic.status === 'UNDER_REVIEW') {
      this.registration.recordSubmission({
        requestId: clinic.requestId,
        veterinaryId: clinic.veterinaryId,
        veterinaryName: clinic.veterinaryName,
        userId: user.userId,
        status: 'UNDER_REVIEW',
        submittedAt: clinic.submittedAt,
      });
      void this.router.navigateByUrl('/registro/estado');
    } else {
      void this.router.navigateByUrl('/inicio');
    }
  }
}
