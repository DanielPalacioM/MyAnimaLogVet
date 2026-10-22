import { Injectable } from '@angular/core';

export type ClinicStatus = 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface AccountClinic {
  veterinaryId: string;
  veterinaryName: string;
  status: ClinicStatus;
  requestId: string;
  /** ISO 8601. */
  submittedAt: string;
}

export interface AccountUser {
  userId: string;
  fullName: string;
  email: string;
  clinic: AccountClinic | null;
}

export interface MockAccount {
  email: string;
  /** Solo para el mock: en producción la contraseña nunca llega al cliente. */
  password: string;
  emailVerified: boolean;
  user: AccountUser;
}

const STORAGE_KEY = 'vet.mock.accounts';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * "Base de datos" de cuentas del mock: login y registro comparten la misma.
 * Se reemplaza al conectar el backend; las vistas no la tocan.
 */
@Injectable({ providedIn: 'root' })
export class MockUserDirectory {
  private readonly seeded: readonly MockAccount[] = [
    {
      email: 'ana@patitas.co',
      password: 'Patitas2026',
      emailVerified: true,
      user: {
        userId: 'u-ana',
        fullName: 'Ana Gómez',
        email: 'ana@patitas.co',
        clinic: {
          veterinaryId: 'vet-patitas',
          veterinaryName: 'Clínica Patitas',
          status: 'ACTIVE',
          requestId: 'req-patitas',
          submittedAt: '2026-09-20T15:00:00.000Z',
        },
      },
    },
    {
      email: 'maria@huellas.co',
      password: 'Huellas2026',
      emailVerified: true,
      user: {
        userId: 'u-maria',
        fullName: 'María Torres',
        email: 'maria@huellas.co',
        clinic: {
          veterinaryId: 'vet-huellas',
          veterinaryName: 'Huellas Veterinaria',
          status: 'UNDER_REVIEW',
          requestId: 'req-huellas',
          submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
        },
      },
    },
    {
      email: 'nueva@correo.com',
      password: 'Segura2026',
      emailVerified: true,
      user: { userId: 'u-nueva', fullName: 'Laura Nueva', email: 'nueva@correo.com', clinic: null },
    },
  ];
  private registered: MockAccount[] = this.restore();

  find(email: string): MockAccount | undefined {
    const key = normalizeEmail(email);
    return [...this.registered, ...this.seeded].find((a) => a.email === key);
  }

  add(account: MockAccount): void {
    this.registered = [...this.registered.filter((a) => a.email !== account.email), account];
    this.persist();
  }

  update(email: string, change: (account: MockAccount) => MockAccount): MockAccount | undefined {
    const current = this.registered.find((a) => a.email === normalizeEmail(email));
    if (!current) return undefined;
    const next = change(current);
    this.registered = this.registered.map((a) => (a === current ? next : a));
    this.persist();
    return next;
  }

  private restore(): MockAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as MockAccount[]) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.registered));
    } catch {
      /* sin storage */
    }
  }
}
