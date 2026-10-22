import { computed, Injectable, signal } from '@angular/core';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'vet.tokens';

/** Guarda el par de tokens (access + refresh). El refresh rota en cada uso: siempre se guarda el par nuevo. */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly pair = signal<TokenPair | null>(this.restore());

  readonly accessToken = computed(() => this.pair()?.accessToken ?? null);
  readonly refreshToken = computed(() => this.pair()?.refreshToken ?? null);
  readonly hasSession = computed(() => this.pair() !== null);

  save(pair: TokenPair): void {
    this.pair.set(pair);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pair));
    } catch {
      /* sin storage */
    }
  }

  clear(): void {
    this.pair.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sin storage */
    }
  }

  private restore(): TokenPair | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TokenPair) : null;
    } catch {
      return null;
    }
  }
}
