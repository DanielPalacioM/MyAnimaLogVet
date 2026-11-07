import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { DocumentType, VerificationStatus } from '@services/register/models/registration.model';
import { RegisterService, VerificationDocument } from '@services/register/register.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { DocumentState } from '@shared/components/document-card/document-card.component';

interface Milestone {
  label: string;
  detail: string;
  state: 'done' | 'current' | 'pending';
}

interface DocRow {
  type: DocumentType;
  title: string;
  hint: string;
  state: DocumentState;
  /** Se puede subir o reemplazar (los ya aprobados quedan bloqueados). */
  editable: boolean;
  fileName: string | null;
  fileSize: number | null;
}

const LABELS: Partial<Record<DocumentType, string>> = {
  RUT: 'RUT',
  CHAMBER_OF_COMMERCE: 'Certificado de Cámara de Comercio',
  LEGAL_REP_ID: 'Cédula del representante legal',
  FACADE_PHOTO: 'Foto de la fachada',
};

const SUPPORT_EMAIL = 'MyAnimaLog@gmail.com';

/**
 * Container: estado de la solicitud de la clínica. Un mismo lugar para los cinco estados del diseño:
 * "En revisión" (Figma 1911:109), "Corrige y reenvía" (1911:198), "¡Aprobada!" (1911:303), "No aprobada" (1911:368)
 * y, después de pedir una nueva solicitud, la subida de documentos desde cero.
 * Una clínica rechazada no tiene token de clínica, por eso el id llega en `?clinica=` y se usa el token normal.
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
  private readonly session = inject(SessionService);
  private readonly clinicId = inject(ActivatedRoute).snapshot.queryParamMap.get('clinica') ?? undefined;
  private readonly receipt = this.store.receipt;

  protected readonly supportEmail = SUPPORT_EMAIL;
  protected readonly supportLink = `mailto:${SUPPORT_EMAIL}?subject=Solicitud%20de%20verificaci%C3%B3n`;
  protected readonly panelReady = true;

  protected readonly status = signal<VerificationStatus>('UNDER_REVIEW');
  protected readonly submittedAt = signal<string>(this.receipt()?.submittedAt ?? new Date().toISOString());
  protected readonly note = signal<string | null>(null);
  protected readonly attemptsRemaining = signal<number | null>(null);
  protected readonly maxAttempts = signal(3);
  protected readonly documents = signal<VerificationDocument[]>([]);
  protected readonly picked = signal<Partial<Record<DocumentType, File>>>({});
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** A dónde lleva "Entrar al panel": directo si ya hay clínica elegida, o al selector. */
  protected readonly panelLink = computed(() => (this.session.hasClinic() ? '/inicio' : '/elegir-clinica'));

  protected readonly title = computed(() => {
    switch (this.status()) {
      case 'NEEDS_CORRECTION':
        return 'Corrige y reenvía';
      case 'DRAFT':
        return 'Sube tus documentos';
      case 'REJECTED':
        return 'No aprobada';
      case 'ACTIVE':
        return '¡Aprobada!';
      default:
        return 'En revisión';
    }
  });

  protected readonly subtitle = computed(() => {
    switch (this.status()) {
      case 'NEEDS_CORRECTION':
        return 'Nuestro equipo revisó tu solicitud y necesita un ajuste';
      case 'DRAFT':
        return 'Sube de nuevo los documentos para enviar tu nueva solicitud';
      case 'REJECTED':
        return 'Revisamos tu solicitud y no pudimos verificar tu clínica';
      case 'ACTIVE':
        return 'Tu clínica ya está verificada y lista para atender';
      default:
        return 'Recibimos tu solicitud. Te avisaremos por correo cuando tengamos una respuesta';
    }
  });

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

  /** Documentos de la clínica: en corrección solo se vuelve a subir lo que pidió el revisor. */
  protected readonly rows = computed<DocRow[]>(() => {
    const correcting = this.status() === 'NEEDS_CORRECTION';
    const mine = this.picked();
    return this.documents()
      .filter((d) => d.type in LABELS)
      .map((d): DocRow => {
        const file = mine[d.type];
        const editable = correcting ? d.status === 'NEEDS_CORRECTION' : d.status !== 'REVIEWED';
        const state: DocumentState = file ? 'ready' : d.status === 'NEEDS_CORRECTION' ? 'correct' : d.status === 'PENDING' ? 'pending' : 'ready';
        const hint = file ? '' : d.status === 'NEEDS_CORRECTION' ? 'Pedido por el revisor' : d.status === 'PENDING' ? (d.required ? 'Obligatorio' : 'Opcional') : 'Revisado';
        return { type: d.type, title: LABELS[d.type]!, hint, state, editable, fileName: file?.name ?? null, fileSize: file?.size ?? null };
      });
  });

  /** Se puede reenviar cuando cada documento pedido (o cada obligatorio, en un intento nuevo) tiene archivo. */
  protected readonly canResubmit = computed(() => {
    const mine = this.picked();
    const correcting = this.status() === 'NEEDS_CORRECTION';
    const needed = this.documents().filter((d) => (correcting ? d.status === 'NEEDS_CORRECTION' : d.required && d.status === 'PENDING'));
    if (correcting) return Object.keys(mine).length > 0 && needed.every((d) => !!mine[d.type]);
    // Borrador: si ya están todos los obligatorios subidos (el envío se cortó al final), basta con enviar sin elegir archivos.
    return this.documents().length > 0 && needed.every((d) => !!mine[d.type]);
  });

  protected readonly canRetry = computed(() => (this.attemptsRemaining() ?? 1) > 0);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.getVerification(this.receipt()?.requestId ?? '', this.clinicId).subscribe({
      next: (v) => {
        this.status.set(v.status);
        if (v.submittedAt) this.submittedAt.set(v.submittedAt);
        this.note.set(v.note ?? null);
        this.attemptsRemaining.set(v.attemptsRemaining ?? null);
        if (v.maxAttempts) this.maxAttempts.set(v.maxAttempts);
        this.documents.set(v.documents ?? []);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos actualizar el estado de tu solicitud.'));
        this.loading.set(false);
      },
    });
  }

  protected pick(type: DocumentType, file: File): void {
    this.picked.update((current) => ({ ...current, [type]: file }));
  }

  /** "Nueva solicitud": abre un intento nuevo y pide los documentos otra vez. */
  protected retry(): void {
    if (this.busy() || !this.canRetry()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.retryVerification(this.clinicId).subscribe({
      next: () => {
        this.picked.set({});
        this.busy.set(false);
        this.load();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos abrir una nueva solicitud.'));
        this.busy.set(false);
      },
    });
  }

  /** "Reenviar a verificación": sube lo elegido y vuelve a enviar la solicitud. */
  protected resubmit(): void {
    if (this.busy() || !this.canResubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.resubmitDocuments(this.picked(), this.clinicId).subscribe({
      next: () => {
        this.picked.set({});
        this.busy.set(false);
        this.load();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos reenviar tu solicitud. Inténtalo de nuevo.'));
        this.busy.set(false);
      },
    });
  }

  protected registerAnother(): void {
    this.store.reset();
    this.nav.go('consent');
  }
}

/** "2026-10-21T…" → "21 oct" */
function formatDay(iso: string): string {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '');
  return `${date.getDate()} ${month}`;
}
