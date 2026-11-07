import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GoogleAuthService } from '@auth/services/google-auth.service';
import { errorMessage } from '@services/api-error';
import { Subscription } from 'rxjs';
import { LoginCredentials, LoginResult } from '@services/login/login.models';
import { LoginService } from '@services/login/login.service';

/** Página del login (Figma 1828:2): llama al servicio (que guarda tokens y sesión) y decide a dónde ir. */
@Component({
  selector: 'vet-login-page',
  standalone: false,
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly api = inject(LoginService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly google = inject(GoogleAuthService);
  private googleSub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.googleSub?.unsubscribe());
  }

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly googleLoading = signal(false);

  /**
   * "Google": el botón oficial vive (invisible) sobre el nuestro. Cuando Google entrega el `idToken`,
   * lo cambiamos por la sesión de la plataforma.
   */
  protected listenGoogle(host: HTMLElement): void {
    this.googleSub?.unsubscribe();
    this.googleSub = this.google.idTokens(host).subscribe({
      next: (token) => this.signInWithGoogle(token),
      error: (e: unknown) => this.error.set(errorMessage(e, 'No pudimos cargar Google. Inténtalo de nuevo.')),
    });
  }

  private signInWithGoogle(idToken: string): void {
    this.error.set(null);
    this.notice.set(null);
    this.googleLoading.set(true);
    this.api.loginWithGoogle(idToken).subscribe({
      next: (result) => {
        this.googleLoading.set(false);
        this.goNext(result);
      },
      error: (e: unknown) => {
        this.googleLoading.set(false);
        this.error.set(errorMessage(e, 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.'));
      },
    });
  }

  protected signIn(credentials: LoginCredentials): void {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.api.login(credentials).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.goNext(result);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos iniciar sesión. Inténtalo de nuevo.'));
        this.loading.set(false);
      },
    });
  }

  /** Una clínica → panel (con aviso si aún no está aprobada). Ninguna o varias → elegir. */
  private goNext({ user }: LoginResult): void {
    // Si venía de un enlace (p. ej. una invitación), vuelve ahí; solo rutas internas.
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    // El equipo de la plataforma entra a su panel de administración (salvo que volviera a una pantalla de admin).
    if (user.platformRole === 'PLATFORM_ADMIN') {
      return void this.router.navigateByUrl(back?.startsWith('/admin') ? back : '/admin');
    }
    if (back && back.startsWith('/') && !back.startsWith('//')) return void this.router.navigateByUrl(back);
    void this.router.navigateByUrl(user.clinic ? '/inicio' : '/elegir-clinica');
  }
}
