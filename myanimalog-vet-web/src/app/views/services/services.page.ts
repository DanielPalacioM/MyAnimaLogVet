import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CatalogService } from '@services/catalog/catalog.service';
import { ClinicBlock, ClinicService } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';

/** Servicios y horarios (Figma 1971:225): catálogo, horario de atención y bloqueos. */
@Component({
  selector: 'vet-services-page',
  standalone: false,
  templateUrl: './services.page.html',
  styleUrl: './services.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage {
  protected readonly svc = inject(CatalogService);
  private readonly store = inject(ClinicStore);
  private readonly actions = inject(PanelActionsService);

  protected newService(): void {
    this.actions.editService().subscribe((input) => {
      if (!input) return;
      this.store.addService({ ...input, active: true });
      this.actions.toast(`Servicio “${input.name}” creado`);
    });
  }

  protected edit(s: ClinicService): void {
    this.actions.editService(s).subscribe((input) => {
      if (!input) return;
      this.store.updateService(s.id, input);
      this.actions.toast('Servicio actualizado');
    });
  }

  protected setOnline(s: ClinicService, online: boolean): void {
    this.store.updateService(s.id, { online });
    this.actions.toast(online ? `“${s.name}” se puede pedir desde la app` : `“${s.name}” ya no se pide desde la app`);
  }

  protected toggleActive(s: ClinicService): void {
    const active = !s.active;
    this.store.updateService(s.id, active ? { active } : { active, online: false });
    this.actions.toast(active ? `“${s.name}” está activo` : `“${s.name}” se desactivó`);
  }

  protected remove(s: ClinicService): void {
    this.actions
      .confirm({ title: `¿Eliminar “${s.name}”?`, message: 'Se quita del catálogo y de la app. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar servicio', danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        if (this.store.removeService(s.id)) {
          this.actions.toast(`“${s.name}” se eliminó`);
        } else {
          this.store.updateService(s.id, { active: false, online: false });
          this.actions.toast(`“${s.name}” tiene citas: no se borra, se desactivó`);
        }
      });
  }

  protected editSchedule(): void {
    this.actions.editSchedule().subscribe((saved) => saved && this.actions.toast('Horario actualizado'));
  }

  protected professionalSchedules(): void {
    this.actions.professionalSchedules().subscribe((saved) => saved && this.actions.toast('Horarios actualizados'));
  }

  protected addBlock(): void {
    this.actions.addBlock().subscribe((input) => {
      if (!input) return;
      this.store.addBlock(input);
      this.actions.toast('Bloqueo agregado');
    });
  }

  protected removeBlock(b: ClinicBlock): void {
    this.actions
      .confirm({ title: `¿Quitar “${b.title}”?`, message: 'Esas horas vuelven a quedar disponibles para agendar.', confirmLabel: 'Quitar bloqueo' })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.removeBlock(b.id);
        this.actions.toast('Bloqueo quitado');
      });
  }

  protected closesAllClinic(b: ClinicBlock): boolean {
    return b.scope === 'CLINIC' && b.allDay;
  }
}
