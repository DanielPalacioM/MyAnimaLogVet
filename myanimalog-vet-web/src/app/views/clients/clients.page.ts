import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { fullDate, longDay, sameDay, dayMonth, hourParts } from '@services/clinic/date.utils';
import { VACCINE } from '@services/clinic/patient-details';
import { ClientFilter, ClientSort, ClientsService } from '@services/clients/clients.service';
import { PanelActionsService } from '@services/panel/panel-actions.service';

/** Clientes (Figma 1964:219): dueños vinculados con la clínica, con su ficha. */
@Component({
  selector: 'vet-clients-page',
  standalone: false,
  templateUrl: './clients.page.html',
  styleUrl: './clients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage implements OnInit {
  protected readonly svc = inject(ClientsService);
  protected readonly store = inject(ClinicStore);
  private readonly actions = inject(PanelActionsService);
  private readonly router = inject(Router);

  protected readonly vaccine = VACCINE;
  protected readonly filters: { value: ClientFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'NEXT', label: 'Con cita próxima' },
    { value: 'MONTH', label: 'Vinculados este mes' },
  ];
  protected readonly sorts: { value: ClientSort; label: string }[] = [
    { value: 'name', label: 'Nombre' },
    { value: 'lastVisit', label: 'Última visita' },
    { value: 'next', label: 'Próxima cita' },
    { value: 'linked', label: 'Vinculado' },
  ];

  ngOnInit(): void {
    this.svc.reset();
    this.svc.selectedId.set(null);
  }

  protected count(f: ClientFilter): number {
    const c = this.svc.counts();
    return f === 'ALL' ? c.all : f === 'NEXT' ? c.next : c.month;
  }

  protected sortLabel(): string {
    return this.sorts.find((s) => s.value === this.svc.sort())?.label ?? '';
  }

  protected setSearch(value: string): void {
    this.svc.query.set(value);
    this.svc.page.set(1);
  }

  /** Avatares alternados como el diseño: morado o ámbar. */
  protected tone(c: Client): { bg: string; fg: string } {
    const odd = [...c.name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 2 === 1;
    return odd ? { bg: '#FFF4E0', fg: '#B26A00' } : { bg: '#F1F0FB', fg: '#4037be' };
  }

  protected linked(c: Client): string {
    return fullDate(c.linkedAt);
  }

  protected via(c: Client): string {
    return c.via === 'CLAIM' && c.claimedPet ? `Reclamó a ${c.claimedPet}` : 'Código QR';
  }

  protected since(c: Client): string {
    return longDay(c.linkedAt);
  }

  protected nextLabel(c: Client): { text: string; today: boolean } | null {
    if (!c.next) return null;
    const t = hourParts(c.next.start);
    const today = sameDay(c.next.start, this.store.now());
    return { text: `${today ? 'Hoy' : dayMonth(c.next.start)} · ${t.time} ${t.suffix}`, today };
  }

  protected firstName(c: Client): string {
    return c.name.split(' ')[0];
  }

  protected history(c: Client) {
    return this.svc.history(c);
  }

  protected showQr(): void {
    this.actions.showLinkCode();
  }

  protected newAppointment(c: Client): void {
    this.actions.newAppointment({ patientId: c.pets[0]?.id });
  }

  protected openPet(name: string): void {
    this.svc.selectedId.set(null);
    void this.router.navigate(['/pacientes'], { queryParams: { q: name } });
  }

  protected call(phone: string): void {
    window.open(`tel:${phone.replace(/\s/g, '')}`, '_self');
  }

  protected remove(c: Client): void {
    this.actions
      .confirm({
        title: `¿Quitar a ${c.name}?`,
        message: `La clínica pierde el acceso a ${c.pets.length === 1 ? 'su mascota' : `sus ${c.pets.length} mascotas`}. ${this.firstName(c)} puede volver a vincularse con el código QR cuando quiera.`,
        confirmLabel: 'Quitar cliente',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.removeClient(c.name);
        this.svc.selectedId.set(null);
        this.actions.toast(`${c.name} ya no está vinculado`);
      });
  }
}
