import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Member } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { fullDate } from '@services/clinic/date.utils';
import { PanelActionsService } from '@services/panel/panel-actions.service';
import { TeamFilter, TeamService } from '@services/team/team.service';
import { errorMessage } from '@services/api-error';
import { Observable } from 'rxjs';

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
    this.reload();
  }

  protected reload(): void {
    this.store.loadTeam().subscribe();
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
    return m.joinedAt ? fullDate(m.joinedAt) : '—';
  }

  /** Reglas del backend: nadie se toca a sí mismo, al dueño no lo toca nadie y solo el dueño toca a un administrador. */
  protected canManage(m: Member): boolean {
    if (!this.svc.iCanManage() || m.self || m.role === 'OWNER') return false;
    return m.role !== 'ADMIN' || this.svc.iAmOwner();
  }

  protected invite(): void {
    this.actions.invite();
  }

  private run(call: Observable<unknown>, ok: string, then?: () => void): void {
    call.subscribe({
      next: () => {
        this.actions.toast(ok);
        then?.();
      },
      error: (e: unknown) => this.actions.toast(errorMessage(e)),
    });
  }

  protected resend(id: string, email: string): void {
    this.run(this.store.resendInvitation(id), `Invitación reenviada a ${email}`);
  }

  protected cancelInvitation(id: string, email: string): void {
    this.actions
      .confirm({ title: 'Cancelar invitación', message: `${email} ya no podrá unirse con ese enlace. Puedes invitarle de nuevo cuando quieras.`, confirmLabel: 'Cancelar invitación', danger: true })
      .subscribe((ok) => ok && this.run(this.store.cancelInvitation(id), 'Invitación cancelada'));
  }

  protected changeRole(m: Member): void {
    this.actions.changeRole(m).subscribe((role) => {
      if (!role || role === 'OWNER') return;
      this.run(this.store.changeRole(m.id, role), `El rol de ${m.name} cambió`);
    });
  }

  protected transfer(m: Member): void {
    const first = m.name.split(' ')[0];
    this.actions
      .confirm({
        title: `¿Transferir la propiedad a ${m.name}?`,
        message: `${first} será quien administre la clínica y el plan, y tú pasarás a Administrador. El representante legal no cambia. Solo ${first} podrá deshacerlo.`,
        confirmLabel: 'Transferir propiedad',
        danger: true,
      })
      .subscribe((ok) => ok && this.run(this.store.transferOwnership(m.id), `${m.name} es ahora quien dirige la clínica`, () => this.svc.selectedId.set(null)));
  }

  protected deactivate(m: Member): void {
    this.actions
      .confirm({ title: `¿Retirar a ${m.name}?`, message: 'Pierde el acceso a la clínica en su siguiente petición. Su historial y lo que firmó se conservan. Para que vuelva, tendrás que invitarle de nuevo.', confirmLabel: 'Retirar', danger: true })
      .subscribe((ok) => ok && this.run(this.store.removeMember(m.id), `${m.name} fue retirado del equipo`));
  }

  protected goSchedule(): void {
    this.svc.selectedId.set(null);
    void this.router.navigateByUrl('/servicios');
  }
}
