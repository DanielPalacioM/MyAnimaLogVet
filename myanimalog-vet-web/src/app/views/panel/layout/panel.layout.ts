import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IconName } from '@shared/components/icon/icon.component';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { SessionService } from '@auth/services/session.service';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';

interface NavItem {
  label: string;
  icon: IconName;
  path: string;
  /** Muestra el número de citas de hoy. */
  badge?: boolean;
  /** Solo dueño y administradores. */
  managers?: boolean;
}

/** Marco del panel: menú lateral (Figma 1932:159) + la vista activa. */
@Component({
  selector: 'vet-panel-layout',
  standalone: false,
  templateUrl: './panel.layout.html',
  styleUrl: './panel.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelLayout implements OnInit {
  protected readonly session = inject(SessionService);
  protected readonly store = inject(ClinicStore);
  private readonly router = inject(Router);
  private readonly actions = inject(PanelActionsService);
  private readonly context = inject(ClinicContextService);

  protected readonly items: readonly NavItem[] = [
    { label: 'Inicio', icon: 'home', path: '/inicio' },
    { label: 'Agenda', icon: 'cal', path: '/agenda', badge: true },
    { label: 'Pacientes', icon: 'paw', path: '/pacientes' },
    { label: 'Clientes', icon: 'users', path: '/clientes' },
    { label: 'Reportes', icon: 'chart', path: '/reportes', managers: true },
    { label: 'Equipo', icon: 'badge', path: '/equipo' },
    { label: 'Servicios y horarios', icon: 'clock', path: '/servicios' },
    { label: 'Mi clínica', icon: 'clinic', path: '/mi-clinica', managers: true },
    { label: 'Plan', icon: 'card', path: '/plan', managers: true },
  ];

  /** El menú solo muestra lo que el rol puede usar. */
  protected readonly nav = computed(() => this.items.filter((i) => !i.managers || this.session.isManager()));

  protected readonly status = computed(() => this.session.clinic()?.status ?? null);
  protected readonly verified = () => this.status() === 'ACTIVE';
  protected readonly statusText = computed(() => STATUS_TEXT[this.status() ?? ''] ?? 'pendiente');
  protected readonly reason = computed(() => this.store.profileDto()?.suspensionReason ?? '');
  protected readonly suspendedSince = computed(() => {
    const at = this.store.profileDto()?.suspendedAt;
    return at ? new Date(at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : '';
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected switchClinic(): void {
    this.store.reset();
    this.context.leave();
    void this.router.navigateByUrl('/elegir-clinica');
  }

  protected signOut(): void {
    this.session.signOut();
    this.store.reset();
    this.actions.toast('Sesión cerrada');
    void this.router.navigateByUrl('/login');
  }
}

const STATUS_TEXT: Record<string, string> = {
  PENDING_DOCUMENTS: 'pendiente de documentos',
  UNDER_REVIEW: 'en revisión',
  NEEDS_CORRECTION: 'esperando correcciones',
  REJECTED: 'no aprobada',
  SUSPENDED: 'suspendida',
};
