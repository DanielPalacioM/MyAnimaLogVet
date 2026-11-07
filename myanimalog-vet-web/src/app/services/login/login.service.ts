import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LoginCredentials, LoginResult } from './login.models';

/**
 * Servicio del login (`POST /auth/local` del User service). Guarda los tokens y la sesión.
 * Errores: `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, o los de red/servidor.
 */
@Injectable()
export abstract class LoginService {
  abstract login(credentials: LoginCredentials): Observable<LoginResult>;

  /** `POST /auth/google` con el `idToken` que entrega Google. */
  abstract loginWithGoogle(idToken: string): Observable<LoginResult>;
}
