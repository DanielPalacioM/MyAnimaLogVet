import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '@services/api-error';
import { AdminApi, AdminClinicDetail } from '@services/api/admin.api';
import { clinicStatusChip, formatDate, formatNitFull, planLabel, requestStatusChip } from '../admin.format';
import { ADMIN_DIALOG_STYLES } from './dialog.styles';

export interface ClinicDetailData {
  id: string;
  name: string;
}

const PLANS = ['FREE', 'BASIC', 'PRO'] as const;
const ROLE_LABELS: Record<string, string> = { OWNER: 'Dueño', ADMIN: 'Administrador', VETERINARIAN: 'Veterinario', ASSISTANT: 'Asistente', RECEPTIONIST: 'Recepción' };

const today = (): string => new Date().toISOString().slice(0, 10);
const inOneYear = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Ficha de una clínica para la plataforma: datos, estado, motivo de suspensión, plan (se puede crear o cambiar),
 * equipo e historial de solicitudes. Cierra con `true` si algo cambió, para recargar la lista.
 */
@Component({
  selector: 'vet-clinic-detail-dialog',
  imports: [FormsModule, DatePipe],
  template: `
    <h2>{{ data.name }}</h2>

    @if (loading()) {
      <p class="lead" role="status">Cargando la ficha…</p>
    } @else if (loadError()) {
      <p class="error" role="alert">{{ loadError() }}</p>
    } @else if (d(); as c) {
      <div class="row">
        <span class="chip" [class]="'chip ' + chip().tone">{{ chip().label }}</span>
        <span class="lead">Registrada el {{ c.createdAt | date: 'd MMM y' }}</span>
      </div>

      @if (c.suspensionReason) {
        <p class="warn">Suspendida el {{ date(c.suspendedAt) }}: {{ c.suspensionReason }}</p>
      }

      <p class="label">Datos</p>
      <dl>
        <dt>Razón social</dt><dd>{{ c.legalName || '—' }}</dd>
        <dt>NIT</dt><dd>{{ nit(c.nit) }}</dd>
        <dt>Ciudad</dt><dd>{{ place(c) }}</dd>
        <dt>Dirección</dt><dd>{{ c.address || '—' }}</dd>
        <dt>Teléfono</dt><dd>{{ c.phone || '—' }}</dd>
        <dt>Correo</dt><dd>{{ c.email || '—' }}</dd>
        <dt>Dueño</dt><dd>{{ c.ownerName || '—' }}{{ c.ownerEmail ? ' · ' + c.ownerEmail : '' }}</dd>
        <dt>Representante</dt><dd>{{ c.legalRepName || '—' }}</dd>
        <dt>Aprobada</dt><dd>{{ date(c.approvedAt) }}</dd>
        <dt>Equipo</dt><dd>{{ team(c) }}</dd>
      </dl>

      <p class="label">Plan</p>
      @if (c.subscription; as s) {
        <p class="lead">{{ plan(s.plan) }} · del {{ date(s.startDate) }} al {{ date(s.endDate) }} · {{ s.active ? 'vigente' : 'vencido' }}</p>
      } @else {
        <p class="lead">Esta clínica todavía no tiene un plan.</p>
      }
      @if (c.status === 'ACTIVE') {
        <div class="plan">
          <label>Plan
            <select [ngModel]="planChoice()" (ngModelChange)="planChoice.set($event)" aria-label="Plan">
              @for (p of plans; track p) { <option [value]="p">{{ p }}</option> }
            </select>
          </label>
          <label>Vence
            <input type="date" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" aria-label="Fecha de vencimiento" />
          </label>
          <button type="button" class="btn" [disabled]="saving() || !endDate()" (click)="savePlan()">
            {{ saving() ? 'Guardando…' : c.subscription ? 'Cambiar plan' : 'Crear plan' }}
          </button>
        </div>
        @if (planError()) {
          <p class="error" role="alert">{{ planError() }}</p>
        }
      } @else {
        <p class="lead">El plan solo se puede gestionar cuando la clínica está activa.</p>
      }

      @if (c.verificationHistory.length) {
        <p class="label">Solicitudes de verificación</p>
        <ul class="hist">
          @for (h of c.verificationHistory; track h.requestId) {
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
      <button type="button" class="btn btn--ghost" (click)="ref.close(changed())">Cerrar</button>
    </div>
  `,
  styles: [
    ADMIN_DIALOG_STYLES,
    `
      :host { width: min(640px, 94vw); max-height: 86vh; overflow-y: auto; }
      .row { display: flex; align-items: center; gap: 10px; }
      dl { display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; margin: 0; font: 500 14px/1.35 'Afacad', sans-serif; }
      dt { color: #8a8a9a; font-weight: 700; }
      dd { margin: 0; overflow-wrap: anywhere; }
      .plan { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
      .plan label { display: grid; gap: 4px; color: #8a8a9a; font: 700 12px/1.3 'Afacad', sans-serif; }
      .plan select, .plan input { box-sizing: border-box; height: 38px; padding: 0 10px; border: 2px solid #000; border-radius: 5px; background: #fff; color: #1a1a2e; font: 500 14px/1 'Afacad', sans-serif; }
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
export class ClinicDetailDialog implements OnInit {
  protected readonly data = inject<ClinicDetailData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ClinicDetailDialog, boolean>>(MatDialogRef);
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);

  protected readonly plans = PLANS;
  protected readonly d = signal<AdminClinicDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly planChoice = signal<string>('PRO');
  protected readonly endDate = signal(inOneYear());
  protected readonly saving = signal(false);
  protected readonly planError = signal('');
  protected readonly changed = signal(false);
  protected readonly chip = computed(() => clinicStatusChip(this.d()?.status ?? ''));

  ngOnInit(): void {
    this.load();
  }

  protected date = formatDate;
  protected nit = formatNitFull;
  protected plan = planLabel;
  protected request = requestStatusChip as (s: string) => ReturnType<typeof requestStatusChip>;

  protected place(c: AdminClinicDetail): string {
    return [c.city, c.department].filter(Boolean).join(', ') || '—';
  }

  protected team(c: AdminClinicDetail): string {
    const active = c.employees.filter((e) => e.active);
    if (!active.length) return '—';
    const count = new Map<string, number>();
    active.forEach((e) => count.set(e.role, (count.get(e.role) ?? 0) + 1));
    return [...count].map(([role, n]) => `${n} ${ROLE_LABELS[role] ?? role}`).join(' · ');
  }

  private load(): void {
    this.loading.set(true);
    this.api.clinicDetail(this.data.id).subscribe({
      next: (detail) => {
        this.d.set(detail);
        if (detail.subscription) {
          this.planChoice.set(detail.subscription.plan.startsWith('PRO') ? 'PRO' : detail.subscription.plan);
          this.endDate.set(detail.subscription.endDate);
        }
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(errorMessage(e, 'No pudimos cargar la ficha de la clínica.'));
        this.loading.set(false);
      },
    });
  }

  protected savePlan(): void {
    const detail = this.d();
    if (!detail || this.saving()) return;
    this.saving.set(true);
    this.planError.set('');
    const request = detail.subscription
      ? this.api.updateSubscription(detail.id, { plan: this.planChoice(), endDate: this.endDate() })
      : this.api.createSubscription(detail.id, { plan: this.planChoice(), startDate: today(), endDate: this.endDate() });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.changed.set(true);
        this.snack.open(detail.subscription ? 'Plan actualizado.' : 'Plan creado.', 'Cerrar', { duration: 3500 });
        this.load();
      },
      error: (e: unknown) => {
        this.planError.set(errorMessage(e));
        this.saving.set(false);
      },
    });
  }
}
