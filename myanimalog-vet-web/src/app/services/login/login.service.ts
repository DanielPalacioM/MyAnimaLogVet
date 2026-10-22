import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LoginCredentials, LoginResult } from './login.models';

/**
 * Servicio del login. Hoy lo implementa el mock; luego una versión HTTP (`POST /api/auth/local`).
 * Se elige la implementación en `login.module.ts` (providers).
 */
@Injectable()
export abstract class LoginService {
  /** Errores: `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`. */
  abstract login(credentials: LoginCredentials): Observable<LoginResult>;
}
