import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Secciones del menú que todavía no se construyen (Clientes, Reportes, Equipo…). */
@Component({
  selector: 'vet-coming-soon-page',
  standalone: false,
  template: `
    <section class="soon">
      <img src="/brand/icon-myanimalog.png" alt="" width="96" />
      <h1>{{ title }}</h1>
      <p>Esta sección estará disponible pronto. Mientras tanto puedes usar Inicio, Agenda y Pacientes.</p>
      <a class="vet-btn vet-btn--primary" routerLink="/inicio">Volver al inicio</a>
    </section>
  `,
  styles: `
    .soon { display: flex; min-height: 70vh; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
    h1 { margin: 0; font: 700 40px/1.1 'Afacad', sans-serif; }
    p { max-width: 420px; margin: 0 0 8px; color: var(--vet-text-2); font: 500 16px/1.4 'Afacad', sans-serif; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonPage {
  protected readonly title = inject(ActivatedRoute).snapshot.data['title'] as string;
}
