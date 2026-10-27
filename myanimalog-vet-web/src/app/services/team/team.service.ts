import { computed, inject, Injectable, signal } from '@angular/core';
import { SessionService } from '@auth/services/session.service';
import { Invitation, LicenseState, Member, MemberRole } from '../clinic/clinic.models';
import { ClinicStore } from '../clinic/clinic.store';

export type TeamFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const DAY = 86_400_000;

export interface InvitationRow {
  invitation: Invitation;
  roleLabel: string;
  /** "Invitada por Ana Gómez". */
  by: string;
  expired: boolean;
  /** "Vence en 5 días". */
  expiresIn: string;
}

/** Estado de la vista Equipo: miembros, invitaciones y la ficha abierta. */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly store = inject(ClinicStore);
  private readonly session = inject(SessionService);

  readonly filter = signal<TeamFilter>('ALL');
  readonly selectedId = signal<string | null>(null);

  readonly members = this.store.members;
  readonly selected = computed(() => this.members().find((m) => m.id === this.selectedId()) ?? null);

  readonly counts = computed(() => ({
    all: this.members().length,
    active: this.members().filter((m) => m.active).length,
    inactive: this.members().filter((m) => !m.active).length,
  }));

  readonly pendingCount = computed(() => this.store.pendingInvitations().length);

  readonly filtered = computed(() => {
    const f = this.filter();
    return this.members().filter((m) => (f === 'ALL' ? true : f === 'ACTIVE' ? m.active : !m.active));
  });

  readonly invitationRows = computed<InvitationRow[]>(() => {
    const now = this.store.now();
    return this.store.invitations().map((i) => {
      const expired = i.expiresAt <= now;
      // Recién enviada, el reloj puede ir unos segundos atrás: se cuenta desde el envío.
      const days = Math.ceil((i.expiresAt - Math.max(now, i.sentAt)) / DAY);
      const first = i.email.split('@')[0].split(/[._]/)[0];
      return {
        invitation: i,
        roleLabel: i.role === 'VET' ? 'Veterinario' : i.role === 'ASSISTANT' ? 'Auxiliar' : i.role === 'RECEPTION' ? 'Recepción' : i.role === 'ADMIN' ? 'Administrador' : 'Dueño',
        by: `${/a$/i.test(first) ? 'Invitada' : 'Invitado'} por ${i.invitedBy}`,
        expired,
        expiresIn: days <= 0 ? 'Vence hoy' : `Vence en ${days} ${days === 1 ? 'día' : 'días'}`,
      };
    });
  });

  /** La persona que tiene la sesión (se marca con "(tú)"). */
  isMe(m: Member): boolean {
    return m.name === this.session.user()?.fullName;
  }

  /** ¿Quien tiene la sesión es la dueña? Solo ella transfiere la propiedad y cambia roles. */
  readonly iAmOwner = computed(() => this.members().some((m) => m.role === 'OWNER' && m.name === this.session.user()?.fullName));

  /** Qué ve en la columna "Historia clínica". */
  clinicalAccess(m: Member): { text: string; tone: 'ok' | 'warn' | 'plain' | 'muted' } {
    if (!m.active) return { text: '—', tone: 'muted' };
    if (m.license === 'VERIFIED') return { text: 'Escribe historia', tone: 'ok' };
    if (m.license === 'IN_REVIEW') return { text: 'Pendiente de tarjeta', tone: 'warn' };
    return m.role === 'RECEPTION' ? { text: 'Datos básicos', tone: 'plain' } : { text: 'Solo enfermería', tone: 'plain' };
  }

  /** Lista de permisos de la ficha ("Qué puede hacer"). `pending` es lo que se desbloquea con la tarjeta. */
  permissions(m: Member): { text: string; pending?: boolean }[] {
    const base = (role: MemberRole, license: LicenseState): { text: string; pending?: boolean }[] => {
      switch (role) {
        case 'OWNER':
        case 'ADMIN':
          return [
            { text: 'Configurar la clínica y gestionar el equipo' },
            { text: 'Ver reportes y el plan' },
            ...(license === 'VERIFIED' ? [{ text: 'Escribir historia clínica' }] : []),
          ];
        case 'VET':
          return license === 'VERIFIED'
            ? [{ text: 'Agenda, pacientes y documentos' }, { text: 'Leer y escribir la historia clínica' }]
            : [{ text: 'Agenda, pacientes y documentos' }, { text: 'Leer la historia clínica' }, { text: 'Escribir historia clínica: cuando se verifique la tarjeta', pending: true }];
        case 'ASSISTANT':
          return [{ text: 'Agenda, pacientes y documentos' }, { text: 'Leer la historia clínica' }, { text: 'Registrar enfermería' }];
        default:
          return [{ text: 'Manejar la agenda' }, { text: 'Registrar pacientes' }, { text: 'Ver solo datos básicos del paciente' }];
      }
    };
    return base(m.role, m.license);
  }

  setFilter(f: TeamFilter): void {
    this.filter.set(f);
  }
}
