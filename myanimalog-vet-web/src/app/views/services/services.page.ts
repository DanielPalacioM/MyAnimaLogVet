import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { errorMessage } from '@services/api-error';
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

  /** Ejecuta el cambio en el servidor y avisa el resultado; si falla, el catálogo no cambia y se explica por qué. */
  private save(request: Observable<void>, done: string): void {
    request.subscribe({
      next: () => this.actions.toast(done),
      error: (e: unknown) => this.actions.toast(errorMessage(e)),
    });
  }

  protected newService(): void {
    this.actions.editService().subscribe((input) => {
      if (input) this.save(this.store.addService(input), `Servicio “${input.name}” creado`);
    });
  }

  protected edit(s: ClinicService): void {
    this.actions.editService(s).subscribe((input) => {
      if (input) this.save(this.store.updateService(s.id, input), 'Servicio actualizado');
    });
  }

  protected setOnline(s: ClinicService, online: boolean): void {
    this.save(
      this.store.updateService(s.id, { online }),
      online ? `“${s.name}” se puede pedir desde la app` : `“${s.name}” ya no se pide desde la app`,
    );
  }

  protected toggleActive(s: ClinicService): void {
    const active = !s.active;
    this.save(this.store.updateService(s.id, { active }), active ? `“${s.name}” está activo` : `“${s.name}” se desactivó`);
  }

  /** El servicio no se borra (hay citas que lo referencian): "Eliminar" lo desactiva y lo quita de la app. */
  protected remove(s: ClinicService): void {
    this.actions
      .confirm({
        title: `¿Quitar “${s.name}”?`,
        message: 'Se desactiva: deja de aparecer al agendar y en la app. Las citas que ya tiene se conservan.',
        confirmLabel: 'Desactivar servicio',
        danger: true,
      })
      .subscribe((ok) => ok && this.save(this.store.deactivateService(s.id), `“${s.name}” se desactivó`));
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
      this.save(this.store.addBlock(input), 'Bloqueo agregado');
    });
  }

  protected removeBlock(b: ClinicBlock): void {
    this.actions
      .confirm({ title: `¿Quitar “${b.title}”?`, message: 'Esas horas vuelven a quedar disponibles para agendar.', confirmLabel: 'Quitar bloqueo' })
      .subscribe((ok) => {
        if (!ok) return;
        this.save(this.store.removeBlock(b.id), 'Bloqueo quitado');
      });
  }

  protected closesAllClinic(b: ClinicBlock): boolean {
    return b.scope === 'CLINIC' && b.allDay;
  }
}
