import { computed, inject, Injectable, signal } from '@angular/core';
import { AccountUser } from '@services/mock/mock-directory';
import { TokenService } from './token.service';

const KEY = 'vet.session';

/** Usuario que inició sesión (y su clínica). Los tokens los guarda `TokenService`. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly tokens = inject(TokenService);
  private readonly _user = signal<AccountUser | null>(this.restore());

  readonly user = this._user.asReadonly();
  readonly clinic = computed(() => this._user()?.clinic ?? null);
  readonly isAuthenticated = computed(() => this.tokens.hasSession() && this._user() !== null);
  readonly firstName = computed(() => this._user()?.fullName.split(' ')[0] ?? '');
  readonly initials = computed(() =>
    (this._user()?.fullName ?? '')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  signIn(user: AccountUser): void {
    this._user.set(user);
    try {
      localStorage.setItem(KEY, JSON.stringify(user));
    } catch {
      /* sin storage */
    }
  }

  signOut(): void {
    this._user.set(null);
    this.tokens.clear();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* sin storage */
    }
  }

  private restore(): AccountUser | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AccountUser) : null;
    } catch {
      return null;
    }
  }
}
