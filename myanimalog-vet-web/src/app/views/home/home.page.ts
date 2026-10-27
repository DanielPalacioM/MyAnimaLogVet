import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Appointment } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { hourParts } from '@services/clinic/date.utils';
import { HomeService } from '@services/home/home.service';
import { PanelActionsService } from '@services/panel/panel-actions.service';

const AVATAR = ['#FFE2B8', '#E3E1F6', '#D9F5EF', '#FCE3E3'];
const AVATAR_BY_NAME: Record<string, string> = { Max: '#FFE2B8', Luna: '#E3E1F6', 'Simón': '#E3E1F6', Toby: '#D9F5EF', Kira: '#FCE3E3' };

/** Inicio (Figma 1932:159): saludo, agenda de hoy, por resolver, acciones rápidas y resumen de la clínica. */
@Component({
  selector: 'vet-home-page',
  standalone: false,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly home = inject(HomeService);
  protected readonly store = inject(ClinicStore);
  private readonly router = inject(Router);
  private readonly actions = inject(PanelActionsService);

  protected readonly query = signal('');
  protected readonly notifications = signal(true);
  /** Cuántas citas se ven (5 al inicio; "N citas más" muestra el resto). */
  protected readonly showAll = signal(false);

  protected visible(): Appointment[] {
    const all = this.home.agenda();
    return this.showAll() ? all : all.slice(0, 5);
  }

  protected hidden(): number {
    return Math.max(0, this.home.agenda().length - 5);
  }

  protected hour(a: Appointment) {
    return hourParts(a.start);
  }

  protected avatar(a: Appointment, index: number): string {
    return AVATAR_BY_NAME[a.patientName] ?? AVATAR[index % AVATAR.length];
  }

  protected breed(a: Appointment): string {
    return this.store.patient(a.patientId)?.breed ?? '';
  }

  protected professionalName(a: Appointment): string {
    return this.store.professional(a.professionalId)?.name ?? '';
  }

  protected search(): void {
    const q = this.query().trim();
    void this.router.navigate(['/pacientes'], { queryParams: q ? { q } : {} });
  }

  protected openAgenda(): void {
    void this.router.navigateByUrl('/agenda');
  }

  protected newAppointment(): void {
    this.actions.newAppointment();
  }

  protected addPatient(): void {
    this.actions.addPatient();
  }

  protected invite(): void {
    this.actions.invite();
  }

  protected qr(): void {
    // El código de vinculación se muestra y se copia desde "Agregar paciente".
    this.actions.addPatient();
  }

  protected notifyVaccines(): void {
    const n = this.home.vaccinesToNotify().length;
    this.home.notifyVaccines();
    this.actions.toast(`Avisamos a ${n} ${n === 1 ? 'dueño' : 'dueños'} sobre la vacuna vencida`);
  }

  protected resend(id: string, name: string): void {
    this.home.resend(id);
    this.actions.toast(`Invitación reenviada a ${name}`);
  }

  protected seePlan(): void {
    void this.router.navigateByUrl('/plan');
  }
}
