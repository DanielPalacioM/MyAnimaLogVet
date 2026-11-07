import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { SessionService } from '@auth/services/session.service';
import { ApiError, errorMessage } from '@services/api-error';
import { SubscriptionDto } from '@services/api/api.models';
import { ClinicApi } from '@services/api/clinic.api';
import { catchError, forkJoin, of, throwError } from 'rxjs';

const PLAN_NAMES: Record<string, string> = { FREE: 'Gratis', BASIC: 'Básico', PRO: 'PRO', PRO_TRIAL: 'Prueba PRO' };

const day = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

/** Container: "Plan". Muestra el plan vigente de la clínica y si ya venció. Los límites de uso por plan llegan cuando el backend los publique. */
@Component({
  selector: 'vet-plan-page',
  standalone: false,
  templateUrl: './plan.page.html',
  styleUrl: './plan.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPage implements OnInit {
  private readonly api = inject(ClinicApi);
  private readonly session = inject(SessionService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly subscription = signal<SubscriptionDto | null>(null);
  protected readonly expired = signal(false);

  protected readonly name = computed(() => PLAN_NAMES[this.subscription()?.plan ?? ''] ?? this.subscription()?.plan ?? '');
  protected readonly trial = computed(() => this.subscription()?.plan === 'PRO_TRIAL');
  protected readonly start = computed(() => (this.subscription() ? day(this.subscription()!.startDate) : ''));
  protected readonly end = computed(() => (this.subscription() ? day(this.subscription()!.endDate) : ''));
  protected readonly daysLeft = computed(() => {
    const s = this.subscription();
    if (!s) return 0;
    return Math.max(0, Math.ceil((new Date(`${s.endDate}T23:59:59`).getTime() - Date.now()) / 86_400_000));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = this.session.clinic()?.veterinaryId;
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      sub: this.api.activeSubscription(id).pipe(catchError((e: unknown) => (e instanceof ApiError && e.code === 'NO_ACTIVE_SUBSCRIPTION' ? of(null) : throwError(() => e)))),
      expired: this.api.isSubscriptionExpired(id).pipe(catchError(() => of({ expired: false, endDate: null }))),
    }).subscribe({
      next: ({ sub, expired }) => {
        this.subscription.set(sub);
        this.expired.set(expired.expired);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos cargar el plan de tu clínica.'));
        this.loading.set(false);
      },
    });
  }
}
