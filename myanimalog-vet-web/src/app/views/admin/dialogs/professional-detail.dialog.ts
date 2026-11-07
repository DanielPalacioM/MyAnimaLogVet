import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { errorMessage } from '@services/api-error';
import { AdminApi, AdminProfessionalDetail } from '@services/api/admin.api';
import { formatDate, formatNumber, licenseChip, PROFESSION_LABELS, requestStatusChip } from '../admin.format';
import { ADMIN_DIALOG_STYLES } from './dialog.styles';

export interface ProfessionalDetailData {
  id: string;
  name: string;
}

/** Ficha de un veterinario para la plataforma. Es el único lugar donde se ve su correo. */
@Component({
  selector: 'vet-professional-detail-dialog',
  template: `
    <h2>{{ data.name }}</h2>

    @if (loading()) {
      <p class="lead" role="status">Cargando la ficha…</p>
    } @else if (loadError()) {
      <p class="error" role="alert">{{ loadError() }}</p>
    } @else if (d(); as p) {
      <div class="row">
        <span class="chip" [class]="'chip ' + chip().tone">{{ chip().label }}</span>
        @if (p.verifiedAt) {
          <span class="lead">Verificada el {{ date(p.verifiedAt) }}</span>
        }
      </div>
      @if (p.rejectionReason) {
        <p class="warn">Motivo del rechazo: {{ p.rejectionReason }}</p>
      }

      <dl>
        <dt>Correo</dt><dd>{{ p.email || '—' }}</dd>
        <dt>Documento</dt><dd>{{ p.documentType }} {{ number(p.documentNumber) }}</dd>
        <dt>Profesión</dt><dd>{{ profession(p.profession) }}</dd>
        <dt>Tarjeta profesional</dt><dd>{{ p.licenseNumber }}</dd>
        <dt>Especialidad</dt><dd>{{ p.specialty || '—' }}</dd>
        <dt>Universidad</dt><dd>{{ p.university || '—' }}</dd>
      </dl>

      @if (p.registryLookupUrl) {
        <a class="link" [href]="p.registryLookupUrl" target="_blank" rel="noopener noreferrer">Consultar en el registro oficial (COMVEZCOL)</a>
      }

      @if (p.verificationHistory.length) {
        <p class="label">Solicitudes de verificación</p>
        <ul class="hist">
          @for (h of p.verificationHistory; track h.requestId) {
            <li>
              <span>Intento {{ h.attemptNumber }}</span>
              <span class="chip" [class]="'chip ' + request(h.status).tone">{{ request(h.status).label }}</span>
              <span class="lead">{{ date(h.submittedAt) }}{{ h.decidedAt ? ' → ' + date(h.decidedAt) : '' }}</span>
            </li>
          }
        </ul>
      }
    }

    <div class="actions">
      <button type="button" class="btn btn--ghost" (click)="ref.close()">Cerrar</button>
    </div>
  `,
  styles: [
    ADMIN_DIALOG_STYLES,
    `
      :host { width: min(600px, 94vw); max-height: 86vh; overflow-y: auto; }
      .row { display: flex; align-items: center; gap: 10px; }
      dl { display: grid; grid-template-columns: 150px 1fr; gap: 6px 12px; margin: 0; font: 500 14px/1.35 'Afacad', sans-serif; }
      dt { color: #8a8a9a; font-weight: 700; }
      dd { margin: 0; overflow-wrap: anywhere; }
      .link { color: #4037be; font: 700 13px/1.3 'Afacad', sans-serif; }
      .hist { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .hist li { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font: 700 14px/1.3 'Afacad', sans-serif; }
      .chip { display: inline-flex; padding: 3px 8px; border-radius: 10px; font: 700 11px/1.3 'Afacad', sans-serif; white-space: nowrap; }
      .chip.ok { background: #e8f5e9; color: #2e7d32; }
      .chip.warn { background: #fff4e0; color: #b26a00; }
      .chip.bad { background: #fef3f2; color: #b42318; }
      .chip.mute { background: #e6e6eb; color: #3d3d4e; }
      .chip.soft { background: #f1f0fb; color: #4037be; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalDetailDialog implements OnInit {
  protected readonly data = inject<ProfessionalDetailData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ProfessionalDetailDialog>>(MatDialogRef);
  private readonly api = inject(AdminApi);

  protected readonly d = signal<AdminProfessionalDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly chip = computed(() => licenseChip(this.d()?.licenseStatus ?? ''));

  protected date = formatDate;
  protected number = formatNumber;
  protected request = requestStatusChip as (s: string) => ReturnType<typeof requestStatusChip>;

  protected profession(value: string): string {
    return PROFESSION_LABELS[value] ?? value;
  }

  ngOnInit(): void {
    this.api.professionalDetail(this.data.id).subscribe({
      next: (detail) => {
        this.d.set(detail);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(errorMessage(e, 'No pudimos cargar la ficha del profesional.'));
        this.loading.set(false);
      },
    });
  }
}
