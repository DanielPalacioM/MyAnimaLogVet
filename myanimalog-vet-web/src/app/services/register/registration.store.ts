import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { DocumentType, DraftSection, emptyDraft, RegistrationDraft, RegistrationFlags, RegistrationReceipt, StepId, STEPS } from '@services/register/models/registration.model';
import { REQUIRED_CLINIC_DOCUMENTS } from '@services/register/models/documents.model';

const DRAFT_KEY = 'vet.registration.draft';
const RECEIPT_KEY = 'vet.registration.receipt';

/**
 * Estado del registro (smart, con signals). Lo comparten todos los pasos de `/registro`.
 * - El borrador se guarda en `sessionStorage` (se borra al cerrar la pestaña). Nunca incluye la contraseña.
 * - Los archivos viven solo en memoria: si se recarga la página hay que volver a subirlos.
 * - El recibo de envío se guarda en `localStorage`, del navegador.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationStore {
  private readonly _draft = signal<RegistrationDraft>(this.restoreDraft());
  private readonly _documents = signal<Partial<Record<DocumentType, File>>>({});
  private readonly _logo = signal<File | null>(null);
  private readonly _receipt = signal<RegistrationReceipt | null>(this.restoreReceipt());

  readonly draft = this._draft.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly logo = this._logo.asReadonly();
  readonly receipt = this._receipt.asReadonly();
  readonly submitted = computed(() => this._receipt() !== null);

  /** La cédula del veterinario ya está cubierta si es el mismo representante legal que sube la suya. */
  readonly idCoveredByLegalRep = computed(
    () => this._draft().legalRep.isSelf === 'yes' && !!this._documents().LEGAL_REP_ID,
  );

  /** Documentos del perfil profesional que faltan (solo si declaró ser veterinario). */
  readonly missingProfileDocuments = computed<DocumentType[]>(() => {
    if (this._draft().profile.isVeterinarian !== 'yes') return [];
    const docs = this._documents();
    const missing: DocumentType[] = [];
    if (!docs.PROFESSIONAL_CARD) missing.push('PROFESSIONAL_CARD');
    if (!docs.ID_DOCUMENT && !this.idCoveredByLegalRep()) missing.push('ID_DOCUMENT');
    return missing;
  });

  readonly missingClinicDocuments = computed<DocumentType[]>(() =>
    REQUIRED_CLINIC_DOCUMENTS.filter((t) => !this._documents()[t]),
  );

  constructor() {
    effect(() => this.persistDraft(this._draft()));
  }

  // ---- Edición del borrador ----

  patch<K extends DraftSection>(section: K, value: RegistrationDraft[K]): void {
    this._draft.update((d) => ({ ...d, [section]: value }));
  }

  setDeclaration(value: boolean): void {
    this._draft.update((d) => ({ ...d, declaration: value }));
  }

  setFlags(flags: Partial<RegistrationFlags>): void {
    this._draft.update((d) => ({ ...d, flags: { ...d.flags, ...flags } }));
  }

  markComplete(step: StepId): void {
    this._draft.update((d) => (d.completed.includes(step) ? d : { ...d, completed: [...d.completed, step] }));
  }

  setDocument(type: DocumentType, file: File | null): void {
    this._documents.update((docs) => {
      const next = { ...docs };
      if (file) next[type] = file;
      else delete next[type];
      return next;
    });
  }

  setLogo(file: File | null): void {
    this._logo.set(file);
  }

  // ---- Avance entre pasos ----

  isComplete(step: StepId): boolean {
    const d = this._draft();
    switch (step) {
      case 'consent':
        return d.consent.dataPolicy && d.consent.terms;
      case 'account':
        return d.flags.accountCreated;
      case 'verify':
        return d.flags.emailVerified;
      case 'documents':
        return d.completed.includes('documents') && this.missingClinicDocuments().length === 0;
      case 'profile':
        return d.completed.includes('profile') && this.missingProfileDocuments().length === 0;
      case 'review':
        return this.submitted();
      default:
        return d.completed.includes(step);
    }
  }

  /** Se puede abrir un paso solo si todos los anteriores están completos. */
  canEnter(step: StepId): boolean {
    for (const s of STEPS) {
      if (s.id === step) return true;
      if (!this.isComplete(s.id)) return false;
    }
    return false;
  }

  /** Primer paso que falta por completar (el destino cuando alguien intenta saltarse pasos). */
  firstOpenStep(): StepId {
    return STEPS.find((s) => !this.isComplete(s.id))?.id ?? 'review';
  }

  // ---- Envío ----

  /** Registra el envío: guarda el recibo, borra el borrador y descarta los archivos en memoria. */
  recordSubmission(receipt: RegistrationReceipt): void {
    this._receipt.set(receipt);
    this._draft.set(emptyDraft());
    this._documents.set({});
    this._logo.set(null);
    try {
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* sin storage */
    }
  }

  /** Empieza de cero (p. ej. para registrar otra clínica). */
  reset(): void {
    this._receipt.set(null);
    this._draft.set(emptyDraft());
    this._documents.set({});
    this._logo.set(null);
    try {
      localStorage.removeItem(RECEIPT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* sin storage */
    }
  }

  // ---- Persistencia ----

  private persistDraft(draft: RegistrationDraft): void {
    if (this._receipt()) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* sin storage */
    }
  }

  private restoreDraft(): RegistrationDraft {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return emptyDraft();
      // Mezcla con el borrador vacío por si el formato cambió entre versiones.
      const saved = JSON.parse(raw) as Partial<RegistrationDraft>;
      const base = emptyDraft();
      return {
        ...base,
        ...saved,
        consent: { ...base.consent, ...saved.consent },
        account: { ...base.account, ...saved.account },
        clinic: { ...base.clinic, ...saved.clinic },
        legalRep: { ...base.legalRep, ...saved.legalRep },
        profile: { ...base.profile, ...saved.profile },
        flags: { ...base.flags, ...saved.flags },
        completed: saved.completed ?? [],
      };
    } catch {
      return emptyDraft();
    }
  }

  private restoreReceipt(): RegistrationReceipt | null {
    try {
      const raw = localStorage.getItem(RECEIPT_KEY);
      if (!raw) return null;
      const receipt = JSON.parse(raw) as RegistrationReceipt;
      return receipt;
    } catch {
      return null;
    }
  }
}
