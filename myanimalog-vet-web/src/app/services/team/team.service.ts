import { computed, inject, Injectable, signal } from '@angular/core';
import { Invitation, LicenseState, Member, MemberRole, ROLE_LABEL } from '../clinic/clinic.models';
import { ClinicStore } from '../clinic/clinic.store';

export type TeamFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const DAY = 86_400_000;

export interface InvitationRow {
  invitation: Invitation;
  roleLabel: string;
  /** "Invitada por Ana Gómez" (vacío si no se sabe quién invitó). */
  by: string;
  expired: boolean;
  /** "Vence en 5 días". */
  expiresIn: string;
}

/** Estado de la vista Equipo: miembros, invitaciones y la ficha abierta. */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly store = inject(ClinicStore);

  readonly filter = signal<TeamFilter>('ALL');
  readonly selectedId = signal<string | null>(null);

  readonly state = this.store.teamState;
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
      const days = Math.ceil((i.expiresAt - Math.max(now, i.sentAt)) / DAY);
      const first = i.email.split('@')[0].split(/[._]/)[0];
      return {
        invitation: i,
        roleLabel: ROLE_LABEL[i.role],
        by: i.invitedBy ? `${/a$/i.test(first) ? 'Invitada' : 'Invitado'} por ${i.invitedBy}` : '',
        expired: i.expired,
        expiresIn: days <= 0 ? 'Vence hoy' : `Vence en ${days} ${days === 1 ? 'día' : 'días'}`,
      };
    });
  });

  /** La persona que tiene la sesión (se marca con "(tú)"). */
  isMe(m: Member): boolean {
    return m.self;
  }

  /** ¿Quien tiene la sesión es la dueña? Solo ella transfiere la propiedad. */
  readonly iAmOwner = this.store.iAmOwner;
  /** Quien puede cambiar roles y retirar: dueña y administradores. */
  readonly iCanManage = computed(() => this.store.myRole() === 'OWNER' || this.store.myRole() === 'ADMIN');

  /** Qué ve en la columna "Historia clínica". */
  clinicalAccess(m: Member): { text: string; tone: 'ok' | 'warn' | 'plain' | 'muted' } {
    if (!m.active) return { text: '—', tone: 'muted' };
    if (m.license === 'VERIFIED') return { text: 'Escribe historia', tone: 'ok' };
    if (m.license === 'IN_REVIEW') return { text: 'Pendiente de tarjeta', tone: 'warn' };
    if (m.license === 'MISSING') return { text: 'Sin tarjeta', tone: 'warn' };
    if (m.license === 'REJECTED') return { text: 'Tarjeta rechazada', tone: 'warn' };
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
            ...(license === 'VERIFIED' ? [{ text: 'Escribir historia clínica' }] : [{ text: 'Escribir historia clínica: cuando se verifique la tarjeta', pending: true }]),
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
