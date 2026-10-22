import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SessionService } from '@auth/services/session.service';
import { TokenService } from '@auth/services/token.service';
import { errorMessage } from '@services/api-error';
import { RegisterService } from '@services/register/register.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { DocumentType, RegistrationSubmission, StepId } from '@services/register/models/registration.model';
import { formatNit } from '@shared/validators/nit';

interface SummaryBlock {
  step: StepId;
  title: string;
  detail: string;
}

const DOCUMENT_SHORT_NAMES: Partial<Record<DocumentType, string>> = {
  RUT: 'RUT',
  CHAMBER_OF_COMMERCE: 'Cámara de Comercio',
  LEGAL_REP_ID: 'cédula',
  FACADE_PHOTO: 'fachada',
};

/** Container: Paso 6 · Revisa y envía (Figma 1910:244). Resumen con "Editar", declaración y envío a verificación. */
@Component({
  selector: 'vet-review-page',
  standalone: false,
  templateUrl: './review.page.html',
  styleUrl: './review.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
  private readonly api = inject(RegisterService);
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly session = inject(SessionService);
  private readonly tokens = inject(TokenService);

  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly attempted = signal(false);
  protected readonly declaration = inject(FormBuilder).nonNullable.control(this.store.draft().declaration, [
    Validators.requiredTrue,
  ]);

  protected readonly blocks = computed<SummaryBlock[]>(() => {
    const { clinic, legalRep, profile } = this.store.draft();
    const docs = this.store.documents();
    const names = (Object.keys(DOCUMENT_SHORT_NAMES) as DocumentType[])
      .filter((t) => docs[t])
      .map((t) => DOCUMENT_SHORT_NAMES[t]!);
    return [
      {
        step: 'clinic',
        title: 'Clínica',
        detail: `${clinic.name} · NIT ${formatNit(clinic.nit, clinic.nitDv)} · ${clinic.city}`,
      },
      {
        step: 'representative',
        title: 'Representante legal',
        detail: `${legalRep.fullName} · ${legalRep.documentType} ${formatNit(legalRep.documentNumber)}`,
      },
      { step: 'documents', title: 'Documentos', detail: joinNames(names) },
      {
        step: 'profile',
        title: 'Perfil profesional',
        detail:
          profile.isVeterinarian === 'yes'
            ? `${profile.profession} · Tarjeta profesional ${profile.licenseNumber}`
            : 'No eres veterinario: lo harás cuando invites a tu equipo',
      },
    ];
  });

  protected edit(step: StepId): void {
    this.nav.edit(step);
  }

  protected back(): void {
    this.nav.back('review');
  }

  protected send(): void {
    this.attempted.set(true);
    this.declaration.markAsTouched();
    this.store.setDeclaration(this.declaration.value);
    if (this.declaration.invalid || this.sending()) return;

    const { account, clinic, legalRep, profile } = this.store.draft();
    const documents = { ...this.store.documents() };
    // La cédula del veterinario es la del representante legal cuando es la misma persona.
    if (profile.isVeterinarian === 'yes' && !documents.ID_DOCUMENT && documents.LEGAL_REP_ID) {
      documents.ID_DOCUMENT = documents.LEGAL_REP_ID;
    }
    const submission: RegistrationSubmission = {
      account,
      clinic,
      legalRep,
      profile,
      logo: this.store.logo(),
      documents,
    };

    this.sending.set(true);
    this.error.set(null);
    this.api.submitRegistration(submission).subscribe({
      next: (receipt) => {
        // Con la solicitud enviada ya puede entrar al panel (con la clínica en revisión).
        this.tokens.save({ accessToken: `mock-access-${receipt.userId}`, refreshToken: `mock-refresh-${receipt.userId}` });
        this.session.signIn({
          userId: receipt.userId,
          fullName: account.fullName,
          email: account.email,
          clinic: {
            veterinaryId: receipt.veterinaryId,
            veterinaryName: receipt.veterinaryName,
            status: 'UNDER_REVIEW',
            requestId: receipt.requestId,
            submittedAt: receipt.submittedAt,
          },
        });
        this.store.recordSubmission(receipt);
        this.nav.goToStatus();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos enviar tu solicitud. Inténtalo de nuevo en un momento.'));
        this.sending.set(false);
      },
    });
  }
}

/** ["RUT", "Cámara de Comercio", "cédula"] → "RUT, Cámara de Comercio y cédula" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
