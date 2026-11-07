import { computed, Injectable, signal } from '@angular/core';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface Stored {
  pair: TokenPair | null;
  clinicToken: string | null;
  clinicId: string | null;
}

const STORAGE_KEY = 'vet.tokens';

/**
 * Guarda el par de tokens normal (access + refresh) y el token de clínica.
 * El refresh rota en cada uso: siempre se guarda el par nuevo. El token de clínica sale de
 * `POST /auth/context/veterinary/{id}` y se pide de nuevo cuando vence o cuando cambia el rol.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly state = signal<Stored>(this.restore());

  readonly accessToken = computed(() => this.state().pair?.accessToken ?? null);
  readonly refreshToken = computed(() => this.state().pair?.refreshToken ?? null);
  readonly clinicToken = computed(() => this.state().clinicToken);
  /** Clínica con la que se está trabajando (la del token de clínica). */
  readonly clinicId = computed(() => this.state().clinicId);
  readonly hasSession = computed(() => this.state().pair !== null);

  /** Guarda el par normal. Si cambia la sesión, el token de clínica anterior ya no sirve. */
  save(pair: TokenPair, keepClinic = true): void {
    this.update({ pair, ...(keepClinic ? {} : { clinicToken: null, clinicId: null }) });
  }

  saveClinic(clinicToken: string, clinicId: string): void {
    this.update({ clinicToken, clinicId });
  }

  clearClinic(): void {
    this.update({ clinicToken: null, clinicId: null });
  }

  clear(): void {
    this.state.set({ pair: null, clinicToken: null, clinicId: null });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sin storage */
    }
  }

  private update(patch: Partial<Stored>): void {
    const next = { ...this.state(), ...patch };
    this.state.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* sin storage */
    }
  }

  private restore(): Stored {
    const empty: Stored = { pair: null, clinicToken: null, clinicId: null };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as Partial<Stored> & Partial<TokenPair>;
      // Formato anterior: solo el par.
      if (parsed.accessToken && parsed.refreshToken) return { ...empty, pair: { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken } };
      return { pair: parsed.pair ?? null, clinicToken: parsed.clinicToken ?? null, clinicId: parsed.clinicId ?? null };
    } catch {
      return empty;
    }
  }
}
