import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { LicenseStatus, ProfessionalApi, ProfessionalDocType, ProfessionalProfile } from '@services/api/professional.api';
import { DocumentState } from '@shared/components/document-card/document-card.component';
import { documentNumberValidator, licenseNumberValidator } from '@shared/validators/common';
import { FileRule, SIGNATURE_RULE, validateFile } from '@shared/validators/files';

interface DocRow {
  type: ProfessionalDocType;
  title: string;
  hint: string;
  state: DocumentState;
  documentId: string | null;
  required: boolean;
}

const DOCS: readonly { type: ProfessionalDocType; title: string; required: boolean }[] = [
  { type: 'PROFESSIONAL_CARD', title: 'Tarjeta profesional', required: true },
  { type: 'ID_DOCUMENT', title: 'Cédula', required: true },
  { type: 'DEGREE', title: 'Diploma', required: false },
];

const STATUS_TEXT: Record<LicenseStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute'; help: string }> = {
  NOT_SUBMITTED: { label: 'Sin enviar', tone: 'mute', help: 'Completa tus datos, sube los documentos y envía tu tarjeta a revisión.' },
  PENDING: { label: 'En revisión', tone: 'warn', help: 'El equipo de MyAnimaLog está revisando tu tarjeta. Mientras tanto no puedes editarla.' },
  VERIFIED: { label: 'Verificada', tone: 'ok', help: 'Tu tarjeta está verificada y vale para todas las clínicas donde trabajes. Si cambias tus datos de identidad se vuelve a revisar.' },
  REJECTED: { label: 'Rechazada', tone: 'bad', help: 'No pudimos verificar tu tarjeta. Corrige lo necesario y vuelve a enviarla.' },
};

/** Container: "Mi perfil profesional". La tarjeta es de la persona: se verifica una sola vez aunque trabaje en varias clínicas. */
@Component({
  selector: 'vet-professional-profile-page',
  standalone: false,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalProfilePage implements OnInit {
  private readonly api = inject(ProfessionalApi);
  private readonly session = inject(SessionService);

  protected readonly professions = [
    { value: 'MV', label: 'Médico veterinario (MV)' },
    { value: 'MVZ', label: 'Médico veterinario zootecnista (MVZ)' },
  ] as const;
  protected readonly idTypes = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PPT', label: 'Permiso por protección temporal' },
  ] as const;
  protected readonly signatureRule: FileRule = SIGNATURE_RULE;

  protected readonly profile = signal<ProfessionalProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly signatureError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    documentType: ['CC' as 'CC' | 'CE' | 'PPT', [Validators.required]],
    documentNumber: ['', [Validators.required, documentNumberValidator]],
    profession: ['' as 'MV' | 'MVZ' | '', [Validators.required]],
    licenseNumber: ['', [Validators.required, licenseNumberValidator]],
    specialty: ['', [Validators.maxLength(80)]],
    university: ['', [Validators.maxLength(120)]],
  });

  protected readonly status = computed(() => STATUS_TEXT[this.profile()?.licenseStatus ?? 'NOT_SUBMITTED']);
  /** Solo se edita sin enviar o tras un rechazo; en revisión queda bloqueado. */
  protected readonly locked = computed(() => this.profile()?.licenseStatus === 'PENDING');
  protected readonly canEditDocs = computed(() => {
    const s = this.profile()?.licenseStatus;
    return s === 'NOT_SUBMITTED' || s === 'REJECTED';
  });

  protected readonly rows = computed<DocRow[]>(() => {
    const have = new Map((this.profile()?.documents ?? []).map((d) => [d.documentType, d]));
    return DOCS.map(({ type, title, required }) => {
      const d = have.get(type);
      const state: DocumentState = d?.status === 'NEEDS_CORRECTION' ? 'correct' : d?.status === 'READY' || d?.status === 'REVIEWED' ? 'ready' : 'pending';
      const hint = state === 'correct' ? 'Pedido por el revisor' : state === 'ready' ? (d?.fileName ?? 'Subido') : required ? 'Obligatorio' : 'Opcional';
      return { type, title, hint, state, documentId: d?.documentId ?? null, required };
    });
  });

  protected readonly hasSignature = computed(() => !!(this.profile()?.signatureUrl || this.profile()?.hasSignature));
  protected readonly canSubmit = computed(
    () => !!this.profile() && this.canEditDocs() && this.rows().filter((r) => r.required).every((r) => r.state === 'ready'),
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.get().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.fill(p);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos cargar tu perfil profesional.'));
        this.loading.set(false);
      },
    });
  }

  private fill(p: ProfessionalProfile | null): void {
    if (!p) {
      this.form.patchValue({ fullName: this.session.user()?.fullName ?? '' });
      return;
    }
    this.form.reset({
      fullName: p.fullName,
      documentType: p.documentType,
      documentNumber: p.documentNumber,
      profession: p.profession,
      licenseNumber: p.licenseNumber,
      specialty: p.specialty ?? '',
      university: p.university ?? '',
    });
    this.locked() ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false });
  }

  protected invalid(c: { invalid: boolean; touched: boolean }): boolean | null {
    return c.invalid && c.touched ? true : null;
  }

  protected save(): void {
    if (this.saving() || this.locked()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.api
      .save({
        fullName: v.fullName.trim(),
        documentType: v.documentType,
        documentNumber: v.documentNumber.replace(/\D/g, '') || v.documentNumber.trim(),
        profession: v.profession as 'MV' | 'MVZ',
        licenseNumber: v.licenseNumber.trim().toUpperCase(),
        ...(v.specialty.trim() ? { specialty: v.specialty.trim() } : {}),
        ...(v.university.trim() ? { university: v.university.trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notice.set('Guardamos tus datos.');
          this.load();
        },
        error: (e: unknown) => {
          this.error.set(errorMessage(e, 'No pudimos guardar tus datos.'));
          this.saving.set(false);
        },
      });
  }

  protected pick(type: ProfessionalDocType, file: File): void {
    this.run(type, this.api.uploadDocument(type, file), 'Subimos el documento.');
  }

  protected remove(row: DocRow): void {
    if (!row.documentId) return;
    this.run(row.type, this.api.deleteDocument(row.documentId), 'Quitamos el documento.');
  }

  protected pickSignature(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = validateFile(file, SIGNATURE_RULE);
    this.signatureError.set(problem);
    if (!problem) this.run('signature', this.api.uploadSignature(file), 'Guardamos tu firma.');
  }

  private run(key: string, request: ReturnType<ProfessionalApi['submit']>, done: string): void {
    if (this.busy()) return;
    this.busy.set(key);
    this.error.set(null);
    this.notice.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(done);
        this.load();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.busy.set(null);
      },
    });
  }

  protected submit(): void {
    if (this.submitting() || !this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.api.submit().subscribe({
      next: () => {
        this.submitting.set(false);
        this.notice.set('Enviamos tu tarjeta a revisión. Te avisaremos por correo.');
        this.load();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos enviar tu tarjeta a revisión.'));
        this.submitting.set(false);
      },
    });
  }
}
