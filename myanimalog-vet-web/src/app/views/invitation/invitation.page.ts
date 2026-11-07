import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ClinicRole } from '@auth/models/session.models';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { InvitationPreviewDto } from '@services/api/api.models';
import { TeamApi } from '@services/api/team.api';

const ROLE_TEXT: Record<ClinicRole, string> = {
  OWNER: 'dueño',
  ADMIN: 'administrador',
  VETERINARIAN: 'veterinario',
  ASSISTANT: 'auxiliar',
  RECEPTIONIST: 'recepción',
};

const CAN: Record<ClinicRole, string[]> = {
  OWNER: ['Configurar la clínica y el equipo.', 'Ver reportes y el plan.'],
  ADMIN: ['Configurar la clínica y gestionar el equipo.', 'Ver reportes.', 'Ver la agenda y atender citas.'],
  VETERINARIAN: ['Ver la agenda y atender citas.', 'Leer la historia de los pacientes compartidos.', 'Registrar consultas, tratamientos y cirugías cuando tu tarjeta profesional esté verificada.'],
  ASSISTANT: ['Ver la agenda y atender citas.', 'Leer la historia de los pacientes compartidos.', 'Registrar enfermería, vacunas y peso.'],
  RECEPTIONIST: ['Manejar la agenda.', 'Registrar pacientes.', 'Ver solo los datos básicos de cada paciente.'],
};

/** Aceptar invitación de empleado (Figma 2035:351). El token llega en el enlace del correo: `/invitacion?token=…`. */
@Component({
  selector: 'vet-invitation-page',
  standalone: false,
  templateUrl: './invitation.page.html',
  styleUrl: './invitation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TeamApi);
  private readonly context = inject(ClinicContextService);
  protected readonly session = inject(SessionService);

  protected readonly token = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly invitation = signal<InvitationPreviewDto | null>(null);

  protected readonly roleText = computed(() => ROLE_TEXT[this.invitation()?.role ?? 'ASSISTANT']);
  protected readonly can = computed(() => CAN[this.invitation()?.role ?? 'ASSISTANT']);
  protected readonly initials = computed(() =>
    (this.invitation()?.veterinaryName ?? '?').split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
  );
  protected readonly expiresText = computed(() => {
    const i = this.invitation();
    return i ? new Date(i.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : '';
  });
  /** Por qué no se puede aceptar (si no se puede). */
  protected readonly blocked = computed(() => {
    const i = this.invitation();
    if (!i || i.usable) return '';
    if (!i.emailMatchesCaller) return `La invitación es para ${i.email}. Iniciaste sesión con otra cuenta: cierra sesión y entra con ese correo.`;
    if (i.expired) return 'La invitación venció. Pídele a quien te invitó que la reenvíe.';
    if (i.status === 'ACCEPTED') return 'Esta invitación ya fue aceptada.';
    if (i.status === 'DECLINED') return 'Rechazaste esta invitación.';
    if (i.status === 'REVOKED') return 'La clínica canceló esta invitación.';
    return 'Esta invitación ya no se puede usar.';
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.token.set(token);
    if (!token) {
      this.error.set('El enlace de la invitación está incompleto. Ábrelo de nuevo desde tu correo.');
      this.loading.set(false);
      return;
    }
    this.api.previewInvitation(token).subscribe({
      next: (i) => {
        this.invitation.set(i);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected accept(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.acceptInvitation(this.token()).subscribe({
      next: (res) => {
        // Después de aceptar hay que pedir un token de clínica nuevo.
        this.context.loadClinics().subscribe({
          next: (clinics) => {
            const clinic = clinics.find((c) => c.veterinaryId === res.veterinaryId);
            if (!clinic) return void this.router.navigateByUrl('/elegir-clinica');
            this.context.enter(clinic).subscribe({
              next: () => void this.router.navigateByUrl('/inicio'),
              error: () => void this.router.navigateByUrl('/elegir-clinica'),
            });
          },
          error: () => void this.router.navigateByUrl('/elegir-clinica'),
        });
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.busy.set(false);
      },
    });
  }

  protected decline(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.declineInvitation(this.token()).subscribe({
      next: () => void this.router.navigateByUrl('/elegir-clinica'),
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.busy.set(false);
      },
    });
  }

  protected signOut(): void {
    this.session.signOut();
    void this.router.navigate(['/login'], { queryParams: { returnUrl: `/invitacion?token=${this.token()}` } });
  }
}
