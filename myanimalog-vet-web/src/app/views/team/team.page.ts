import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Member } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { fullDate } from '@services/clinic/date.utils';
import { PanelActionsService } from '@services/panel/panel-actions.service';
import { TeamFilter, TeamService } from '@services/team/team.service';

/** Equipo (Figma 1965:219): miembros, invitaciones pendientes y la ficha de cada persona. */
@Component({
  selector: 'vet-team-page',
  standalone: false,
  templateUrl: './team.page.html',
  styleUrl: './team.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPage implements OnInit {
  protected readonly svc = inject(TeamService);
  protected readonly store = inject(ClinicStore);
  private readonly actions = inject(PanelActionsService);
  private readonly router = inject(Router);

  protected readonly filters: { value: TeamFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'INACTIVE', label: 'Inactivos' },
  ];

  ngOnInit(): void {
    this.svc.setFilter('ALL');
    this.svc.selectedId.set(null);
  }

  protected count(f: TeamFilter): number {
    const c = this.svc.counts();
    return f === 'ALL' ? c.all : f === 'ACTIVE' ? c.active : c.inactive;
  }

  protected summary(): string {
    const n = this.svc.pendingCount();
    const a = this.svc.counts().active;
    return `${a} ${a === 1 ? 'activo' : 'activos'} · ${n} ${n === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}`;
  }

  protected tone(m: Member): { bg: string; fg: string } {
    if (!m.active) return { bg: '#F0F0F3', fg: '#8A8A9A' };
    const odd = [...m.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 2 === 1;
    return odd ? { bg: '#FFF4E0', fg: '#B26A00' } : { bg: '#F1F0FB', fg: '#4037BE' };
  }

  protected initials(m: Member): string {
    return m.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  protected joined(m: Member): string {
    return fullDate(m.joinedAt);
  }

  protected canManage(m: Member): boolean {
    return this.svc.iAmOwner() && m.role !== 'OWNER';
  }

  protected invite(): void {
    this.actions.invite();
  }

  protected resend(id: string, email: string): void {
    this.store.resendInvitation(id);
    this.actions.toast(`Invitación reenviada a ${email}`);
  }

  protected cancelInvitation(id: string, email: string): void {
    this.actions
      .confirm({ title: 'Cancelar invitación', message: `${email} ya no podrá unirse con ese correo. Puedes invitarle de nuevo cuando quieras.`, confirmLabel: 'Cancelar invitación', danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.cancelInvitation(id);
        this.actions.toast('Invitación cancelada');
      });
  }

  protected changeRole(m: Member): void {
    this.actions.changeRole(m).subscribe((role) => {
      if (!role) return;
      this.store.changeRole(m.id, role);
      this.actions.toast(`${m.name} ahora es ${this.store.members().find((x) => x.id === m.id)?.roleLabel.toLowerCase()}`);
    });
  }

  protected transfer(m: Member): void {
    this.actions
      .confirm({
        title: `¿Transferir la propiedad a ${m.name}?`,
        message: `${m.name.split(' ')[0]} será quien administre la clínica y el plan, y tú pasarás a Administrador. Solo ${m.name.split(' ')[0]} podrá deshacerlo.`,
        confirmLabel: 'Transferir propiedad',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.transferOwnership(m.id);
        this.svc.selectedId.set(null);
        this.actions.toast(`${m.name} es ahora quien dirige la clínica`);
      });
  }

  protected deactivate(m: Member): void {
    this.actions
      .confirm({ title: `¿Desactivar a ${m.name}?`, message: 'Pierde el acceso a la clínica en máximo 15 minutos. Su historial y sus citas se conservan y puedes volver a activarle.', confirmLabel: 'Desactivar', danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.setMemberActive(m.id, false);
        this.actions.toast(`${m.name} fue desactivado`);
      });
  }

  protected activate(m: Member): void {
    this.store.setMemberActive(m.id, true);
    this.actions.toast(`${m.name} volvió a estar activo`);
  }

  protected goSchedule(): void {
    this.svc.selectedId.set(null);
    void this.router.navigateByUrl('/servicios');
  }
}
