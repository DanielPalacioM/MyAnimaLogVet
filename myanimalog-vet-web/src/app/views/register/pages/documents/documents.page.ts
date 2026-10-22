import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CLINIC_DOCUMENTS, DOCUMENT_SPECS } from '@services/register/models/documents.model';
import { DocumentType } from '@services/register/models/registration.model';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';

/** Container: Paso 4 · Documentos (Figma 1910:20). RUT, Cámara de Comercio y cédula son obligatorios. */
@Component({
  selector: 'vet-documents-page',
  standalone: false,
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);

  protected readonly specs = DOCUMENT_SPECS;
  protected readonly types = CLINIC_DOCUMENTS;
  protected readonly documents = this.store.documents;
  protected readonly error = signal<string | null>(null);

  protected pick(type: DocumentType, file: File): void {
    this.store.setDocument(type, file);
    this.error.set(null);
  }

  protected back(): void {
    this.nav.back('documents');
  }

  protected next(): void {
    const missing = this.store.missingClinicDocuments();
    if (missing.length > 0) {
      const names = missing.map((t) => DOCUMENT_SPECS[t].title).join(', ');
      this.error.set(`Falta subir: ${names}.`);
      return;
    }
    this.store.markComplete('documents');
    this.nav.next('documents');
  }
}
