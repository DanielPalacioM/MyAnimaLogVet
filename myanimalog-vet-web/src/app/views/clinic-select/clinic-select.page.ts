import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClinicRole, ClinicStatus, ClinicSummary } from '@auth/models/session.models';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { MyInvitationDto } from '@services/api/api.models';
import { TeamApi } from '@services/api/team.api';
import { ClinicStore } from '@services/clinic/clinic.store';
import { STATUS_PATH } from '@services/register/models/registration.model';
import { RegistrationStore } from '@services/register/registration.store';

const ROLE_TEXT: Record<ClinicRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  VETERINARIAN: 'Veterinario',
  ASSISTANT: 'Auxiliar',
  RECEPTIONIST: 'Recepción',
};

/** Estados que se atienden en la pantalla de estado del registro, no en el panel. */
const STATUS_SCREEN: ReadonlySet<ClinicStatus> = new Set<ClinicStatus>(['REJECTED', 'NEEDS_CORRECTION', 'PENDING_DOCUMENTS']);

const STATUS_TEXT: Record<ClinicStatus, string> = {
  ACTIVE: 'Activa',
  UNDER_REVIEW: 'En revisión',
  PENDING_DOCUMENTS: 'Pendiente de documentos',
  NEEDS_CORRECTION: 'Requiere corrección',
  REJECTED: 'No aprobada',
  SUSPENDED: 'Suspendida',
};

/** Elige tu clínica (Figma 2035:225 y 2035:284): con cuál clínica se trabaja ahora. */
@Component({
  selector: 'vet-clinic-select-page',
  standalone: false,
  templateUrl: './clinic-select.page.html',
  styleUrl: './clinic-select.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicSelectPage implements OnInit {
  protected readonly session = inject(SessionService);
  private readonly context = inject(ClinicContextService);
  private readonly teamApi = inject(TeamApi);
  private readonly store = inject(ClinicStore);
  private readonly registration = inject(RegistrationStore);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly entering = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly invitations = signal<MyInvitationDto[]>([]);
  protected readonly clinics = computed(() => this.session.clinics());
  protected readonly email = computed(() => this.session.user()?.email ?? '');

  ngOnInit(): void {
    // Cambiar de clínica empieza de cero: nada de la anterior se queda.
    this.store.reset();
    this.context.leave();
    this.context.loadClinics().subscribe({
      next: () => this.loading.set(false),
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
    this.teamApi.myInvitations().subscribe({ next: (list) => this.invitations.set(list), error: () => this.invitations.set([]) });
  }

  /** Cada registro empieza limpio: ni el borrador ni el recibo de uno anterior. */
  protected newRegistration(): void {
    this.registration.reset();
  }

  protected roleText(role?: ClinicRole): string {
    return role ? ROLE_TEXT[role] : '';
  }

  protected statusText(status: ClinicStatus): string {
    return STATUS_TEXT[status] ?? status;
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  protected expires(iso: string): string {
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
    return days <= 0 ? 'vence hoy' : `vence en ${days} ${days === 1 ? 'día' : 'días'}`;
  }

  protected choose(clinic: ClinicSummary): void {
    if (this.entering()) return;
    this.error.set('');
    // Rechazada, en corrección o sin documentos: se resuelve en la pantalla de estado (el User service no emite
    // token de clínica para una rechazada, así que allí se usa el token normal).
    if (STATUS_SCREEN.has(clinic.status)) {
      void this.router.navigate(['/registro', STATUS_PATH], { queryParams: { clinica: clinic.veterinaryId } });
      return;
    }
    this.entering.set(clinic.veterinaryId);
    this.context.enter(clinic).subscribe({
      next: () => void this.router.navigateByUrl('/inicio'),
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.entering.set(null);
      },
    });
  }

  protected signOut(): void {
    this.session.signOut();
    this.store.reset();
    void this.router.navigateByUrl('/login');
  }
}
