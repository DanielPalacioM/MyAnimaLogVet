import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PAGE_SIZE, PatientSort, PatientsService, SpeciesTab } from '@services/patients/patients.service';
import { Appointment, STATUS_LABEL, VaccineState } from '@services/clinic/clinic.models';
import { dayMonth, hourParts, longDate, sameDay } from '@services/clinic/date.utils';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';

const VACCINE: Record<VaccineState, { label: string; fg: string; bg: string }> = {
  OK: { label: 'Al día', fg: '#2E7D32', bg: '#E8F5E9' },
  DUE: { label: 'Por vencer', fg: '#B26A00', bg: '#FFF4E0' },
  OVERDUE: { label: 'Vencida', fg: '#B42318', bg: '#FEF3F2' },
  NONE: { label: 'Sin registro', fg: '#3D3D4E', bg: '#E6E6EB' },
};

/** Pacientes (Figma 1958:174): lista con búsqueda, filtros, orden, paginación y ficha. */
@Component({
  selector: 'vet-patients-page',
  standalone: false,
  templateUrl: './patients.page.html',
  styleUrl: './patients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientsPage implements OnInit {
  protected readonly svc = inject(PatientsService);
  protected readonly store = inject(ClinicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actions = inject(PanelActionsService);

  protected readonly tabs: { value: SpeciesTab; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'Perro', label: 'Perros' },
    { value: 'Gato', label: 'Gatos' },
    { value: 'Otro', label: 'Otros' },
  ];
  protected readonly sorts: { value: PatientSort; label: string }[] = [
    { value: 'lastVisit', label: 'Última visita' },
    { value: 'name', label: 'Nombre' },
    { value: 'nextAppointment', label: 'Próxima cita' },
  ];
  protected readonly vaccine = VACCINE;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly pageSize = PAGE_SIZE;

  ngOnInit(): void {
    // Viene de la búsqueda del Inicio: /pacientes?q=...
    const q = this.route.snapshot.queryParamMap.get('q');
    this.svc.query.set(q ?? '');
    this.svc.page.set(1);
  }

  protected count(tab: SpeciesTab): number {
    const c = this.svc.counts();
    return tab === 'ALL' ? c.all : tab === 'Perro' ? c.dogs : tab === 'Gato' ? c.cats : c.others;
  }

  protected sortLabel(): string {
    return this.sorts.find((s) => s.value === this.svc.sort())?.label ?? '';
  }

  protected onSearch(value: string): void {
    this.svc.query.set(value);
    this.svc.page.set(1);
    void this.router.navigate([], { queryParams: value ? { q: value } : {}, replaceUrl: true });
  }

  protected goTo(page: number | '…'): void {
    if (page !== '…') this.svc.page.set(Math.min(Math.max(1, page), this.svc.pageCount()));
  }

  protected nextLabel(next: { start: number; professionalName: string } | null): { when: string; who: string } | null {
    if (!next) return null;
    const t = hourParts(next.start);
    const when = sameDay(next.start, this.store.now()) ? `Hoy · ${t.time} ${t.suffix}` : `${dayMonth(next.start)} · ${t.time} ${t.suffix}`;
    return { when, who: next.professionalName };
  }

  protected dateLabel(ms: number): string {
    return longDate(ms);
  }

  protected timeOf(a: Appointment): string {
    const t = hourParts(a.start);
    return `${t.time} ${t.suffix}`;
  }

  protected newAppointment(patientId?: string): void {
    this.actions.newAppointment({ patientId });
  }

  protected add(): void {
    this.actions.addPatient();
  }

  protected claimLink(owner: string): void {
    this.actions.toast(`Enlace para reclamar enviado a ${owner}`);
  }
}
