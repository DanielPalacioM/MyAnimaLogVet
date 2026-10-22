import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { errorMessage } from '@services/api-error';
import { RegisterService } from '@services/register/register.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { VerificationStatus } from '@services/register/models/registration.model';

interface Milestone {
  label: string;
  detail: string;
  state: 'done' | 'current' | 'pending';
}

/**
 * Container: estado de la solicitud "En revisión" (Figma 1911:109).
 * Tras enviar, el equipo de MyAnimaLog responde en 24 a 48 h. Mientras tanto la clínica puede entrar al panel
 * a configurarse (horarios, servicios, equipo), pero no recibe pacientes ni aparece en el directorio.
 * Los demás estados (corrección, aprobada, rechazada) llegan después.
 */
@Component({
  selector: 'vet-status-page',
  standalone: false,
  templateUrl: './status.page.html',
  styleUrl: './status.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPage {
  private readonly api = inject(RegisterService);
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly receipt = this.store.receipt;

  /** El panel todavía no existe: hasta entonces los accesos a "Ir al panel" quedan desactivados. */
  protected readonly panelReady = false;

  protected readonly status = signal<VerificationStatus>('UNDER_REVIEW');
  protected readonly submittedAt = signal<string>(this.receipt()?.submittedAt ?? new Date().toISOString());
  protected readonly error = signal<string | null>(null);

  protected readonly milestones = computed<Milestone[]>(() => [
    { label: 'Enviado', detail: formatDay(this.submittedAt()), state: 'done' },
    { label: 'En revisión', detail: 'Ahora', state: 'current' },
    { label: 'Aprobada', detail: '24 a 48 h', state: 'pending' },
  ]);

  protected readonly tasks = [
    { icon: 'calendar_today', label: 'Configura tus horarios de atención', link: '/servicios' },
    { icon: 'format_list_bulleted', label: 'Crea tu catálogo de servicios', link: '/servicios' },
    { icon: 'person_add_alt', label: 'Invita a tu equipo', link: '/equipo' },
  ] as const;

  protected registerAnother(): void {
    this.store.reset();
    this.nav.go('consent');
  }

  constructor() {
    const receipt = this.receipt();
    if (!receipt) return;
    this.api.getVerification(receipt.requestId).subscribe({
      next: (v) => {
        this.status.set(v.status);
        this.submittedAt.set(v.submittedAt);
      },
      error: (e: unknown) => this.error.set(errorMessage(e, 'No pudimos actualizar el estado de tu solicitud.')),
    });
  }
}

/** "2026-10-21T…" → "21 oct" */
function formatDay(iso: string): string {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '');
  return `${date.getDate()} ${month}`;
}
