import { computed, inject, Injectable, signal } from '@angular/core';
import { isManager } from '../permissions';
import { AccountClinic, AccountUser, ClinicStatus, ClinicSummary } from '../models/session.models';
import { TokenService } from './token.service';

const KEY = 'vet.session';

interface Stored {
  user: AccountUser | null;
  clinics: ClinicSummary[];
}

/**
 * Quién inició sesión y con qué clínica trabaja. Los tokens los guarda `TokenService`.
 * `clinics` es la lista de clínicas de la persona (para el selector).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly tokens = inject(TokenService);
  private readonly state = signal<Stored>(this.restore());

  readonly user = computed(() => this.state().user);
  readonly clinic = computed(() => this.state().user?.clinic ?? null);
  readonly clinics = computed(() => this.state().clinics);
  readonly isAuthenticated = computed(() => this.tokens.hasSession() && this.state().user !== null);
  /** Hay sesión y ya eligió con qué clínica trabaja (tiene token de clínica). */
  readonly hasClinic = computed(() => this.isAuthenticated() && !!this.tokens.clinicToken() && this.clinic() !== null);
  /** Rol de la persona en la clínica con la que trabaja (el del token de clínica). */
  readonly clinicRole = computed(() => this.clinic()?.role ?? null);
  /** Dueño o administrador: configura la clínica y gestiona al equipo. */
  readonly isManager = computed(() => isManager(this.clinicRole()));
  readonly isPlatformAdmin = computed(() => this.state().user?.platformRole === 'PLATFORM_ADMIN');
  readonly firstName = computed(() => this.state().user?.fullName.split(' ')[0] ?? '');
  readonly initials = computed(() =>
    (this.state().user?.fullName ?? '')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  signIn(user: AccountUser, clinics?: ClinicSummary[]): void {
    this.set({ user, clinics: clinics ?? this.state().clinics });
  }

  setClinics(clinics: ClinicSummary[]): void {
    this.set({ ...this.state(), clinics });
  }

  /** Elige la clínica con la que se trabaja. */
  selectClinic(clinic: AccountClinic | null): void {
    const user = this.state().user;
    if (user) this.set({ ...this.state(), user: { ...user, clinic } });
  }

  /** Actualiza datos de la clínica actual (nombre, estado) sin cambiar de clínica. */
  patchClinic(patch: Partial<AccountClinic>): void {
    const clinic = this.clinic();
    if (!clinic) return;
    const clinics = this.state().clinics.map((c) => (c.veterinaryId === clinic.veterinaryId ? { ...c, ...pick(patch) } : c));
    this.set({ user: { ...this.state().user!, clinic: { ...clinic, ...patch } }, clinics });
  }

  setFullName(fullName: string): void {
    const user = this.state().user;
    if (user && fullName && fullName !== user.fullName) this.set({ ...this.state(), user: { ...user, fullName } });
  }

  statusOf(clinic: ClinicSummary | null = this.clinic()): ClinicStatus | null {
    return clinic?.status ?? null;
  }

  signOut(): void {
    this.state.set({ user: null, clinics: [] });
    this.tokens.clear();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* sin storage */
    }
  }

  private set(next: Stored): void {
    this.state.set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* sin storage */
    }
  }

  private restore(): Stored {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { user: null, clinics: [] };
      const parsed = JSON.parse(raw) as Partial<Stored> & Partial<AccountUser>;
      // Formato anterior: solo el usuario.
      if (parsed.userId) return { user: parsed as AccountUser, clinics: [] };
      return { user: parsed.user ?? null, clinics: parsed.clinics ?? [] };
    } catch {
      return { user: null, clinics: [] };
    }
  }
}

const pick = (patch: Partial<AccountClinic>): Partial<ClinicSummary> => ({
  ...(patch.veterinaryName !== undefined ? { veterinaryName: patch.veterinaryName } : {}),
  ...(patch.status !== undefined ? { status: patch.status } : {}),
  ...(patch.city !== undefined ? { city: patch.city } : {}),
  ...(patch.role !== undefined ? { role: patch.role } : {}),
});
