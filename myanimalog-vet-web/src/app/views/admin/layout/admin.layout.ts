import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@auth/services/session.service';
import { AdminState } from '@services/admin/admin.state';
import { IconName } from '@shared/components/icon/icon.component';

interface AdminItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: boolean;
}

/** Marco del panel de la plataforma (Figma 2040:300): menú propio del equipo y el área de trabajo. */
@Component({
  selector: 'vet-admin-layout',
  standalone: false,
  templateUrl: './admin.layout.html',
  styleUrl: './admin.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout implements OnInit {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly state = inject(AdminState);

  protected readonly items: readonly AdminItem[] = [
    { path: '/admin/verificaciones', label: 'Verificaciones', icon: 'home' },
    { path: '/admin/clinicas', label: 'Clínicas', icon: 'cal', badge: true },
    { path: '/admin/profesionales', label: 'Profesionales', icon: 'paw' },
  ];

  ngOnInit(): void {
    this.state.refresh();
  }

  protected signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl('/login');
  }
}
