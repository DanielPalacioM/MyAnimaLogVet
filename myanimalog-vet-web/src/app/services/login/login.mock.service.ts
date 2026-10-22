import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { mockFailure, mockResponse } from '../mock/mock.config';
import { MockUserDirectory } from '../mock/mock-directory';
import { LoginCredentials, LoginResult } from './login.models';
import { LoginService } from './login.service';

@Injectable()
export class LoginMockService extends LoginService {
  private readonly directory = inject(MockUserDirectory);

  login({ email, password }: LoginCredentials): Observable<LoginResult> {
    const account = this.directory.find(email);
    // Mismo mensaje para "no existe" y "contraseña incorrecta": no revelar qué correos están registrados.
    if (!account || account.password !== password) {
      return mockFailure('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }
    if (!account.emailVerified) {
      return mockFailure('EMAIL_NOT_VERIFIED', 'Verifica tu correo antes de entrar.');
    }
    return mockResponse({
      tokens: { accessToken: `mock-access-${account.user.userId}`, refreshToken: `mock-refresh-${account.user.userId}` },
      user: account.user,
    });
  }
}
