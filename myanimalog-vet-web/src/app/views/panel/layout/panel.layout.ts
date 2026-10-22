import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@auth/services/session.service';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Muestra el número de citas de hoy. */
  badge?: boolean;
}

/** Marco del panel: menú lateral (Figma 1932:159) + la vista activa. */
@Component({
  selector: 'vet-panel-layout',
  standalone: false,
  templateUrl: './panel.layout.html',
  styleUrl: './panel.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelLayout {
  protected readonly session = inject(SessionService);
  protected readonly store = inject(ClinicStore);
  private readonly router = inject(Router);
  private readonly actions = inject(PanelActionsService);

  protected readonly items: readonly NavItem[] = [
    { label: 'Inicio', icon: 'home', path: '/inicio' },
    { label: 'Agenda', icon: 'calendar_today', path: '/agenda', badge: true },
    { label: 'Pacientes', icon: 'pets', path: '/pacientes' },
    { label: 'Clientes', icon: 'group', path: '/clientes' },
    { label: 'Reportes', icon: 'bar_chart', path: '/reportes' },
    { label: 'Equipo', icon: 'badge', path: '/equipo' },
    { label: 'Servicios y horarios', icon: 'schedule', path: '/servicios' },
    { label: 'Mi clínica', icon: 'storefront', path: '/mi-clinica' },
    { label: 'Plan', icon: 'credit_card', path: '/plan' },
  ];

  protected readonly verified = () => this.session.clinic()?.status === 'ACTIVE';

  protected signOut(): void {
    this.session.signOut();
    this.actions.toast('Sesión cerrada');
    void this.router.navigateByUrl('/login');
  }
}
