import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { ChoiceOption } from '@shared/components/choice-cards/choice-cards.component';
import { startWith } from 'rxjs';
import { DOCUMENT_SPECS } from '@services/register/models/documents.model';
import { DocumentType, Profession, YesNo } from '@services/register/models/registration.model';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { focusFirstInvalid } from '@shared/utils/focus-first-invalid';
import { licenseNumberValidator } from '@shared/validators/common';

/**
 * Container: Paso 5 · Perfil profesional (Figma 1910:131). Verificación de quien firma historias clínicas.
 * La licencia es de la persona, no de la clínica. Si no es veterinario, el paso se completa sin datos.
 */
@Component({
  selector: 'vet-profile-page',
  standalone: false,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly specs = DOCUMENT_SPECS;
  protected readonly documents = this.store.documents;
  protected readonly idCovered = this.store.idCoveredByLegalRep;
  protected readonly error = signal<string | null>(null);

  protected readonly options: readonly ChoiceOption<YesNo>[] = [
    { value: 'yes', label: 'Sí, soy veterinario' },
    { value: 'no', label: 'No' },
  ];
  protected readonly professions: readonly { value: Profession; label: string }[] = [
    { value: 'MV', label: 'Médico veterinario (MV)' },
    { value: 'MVZ', label: 'Médico veterinario zootecnista (MVZ)' },
  ];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    isVeterinarian: [this.store.draft().profile.isVeterinarian as YesNo | null, [Validators.required]],
    profession: [this.store.draft().profile.profession as Profession | '', [Validators.required]],
    licenseNumber: [this.store.draft().profile.licenseNumber, [Validators.required, licenseNumberValidator]],
    specialty: [this.store.draft().profile.specialty, [Validators.maxLength(80)]],
    university: [this.store.draft().profile.university, [Validators.maxLength(120)]],
  });

  protected readonly isVeterinarian = toSignal(
    this.form.controls.isVeterinarian.valueChanges.pipe(startWith(this.form.controls.isVeterinarian.value)),
    { initialValue: this.form.controls.isVeterinarian.value },
  );
  protected readonly messages = {
    isVeterinarian: { required: 'Elige una opción.' },
    profession: { required: 'Selecciona tu profesión.' },
  };

  constructor() {
    this.applyMode(this.form.controls.isVeterinarian.value);
    this.form.controls.isVeterinarian.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.applyMode(value));
  }

  protected invalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected state(type: DocumentType): 'ready' | 'pending' {
    return this.documents()[type] ? 'ready' : 'pending';
  }

  protected pick(type: DocumentType, file: File): void {
    this.store.setDocument(type, file);
    this.error.set(null);
  }

  protected back(): void {
    this.nav.back('profile');
  }

  protected next(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const v = this.form.getRawValue();
    const isVet = v.isVeterinarian === 'yes';
    // Primero se guarda la respuesta: los documentos que faltan dependen de si es veterinario.
    this.store.patch('profile', {
      isVeterinarian: v.isVeterinarian,
      profession: isVet ? v.profession : '',
      licenseNumber: isVet ? v.licenseNumber.trim().toUpperCase() : '',
      specialty: isVet ? v.specialty.trim() : '',
      university: isVet ? v.university.trim() : '',
    });
    const missing = this.store.missingProfileDocuments();
    if (missing.length > 0) {
      this.error.set(`Falta subir: ${missing.map((t) => DOCUMENT_SPECS[t].title).join(', ')}.`);
      return;
    }
    this.store.markComplete('profile');
    this.nav.next('profile');
  }

  /** Solo quien es veterinario llena profesión y tarjeta; para los demás esos campos no aplican. */
  private applyMode(value: YesNo | null): void {
    const { profession, licenseNumber, specialty, university } = this.form.controls;
    const fields = [profession, licenseNumber, specialty, university];
    if (value === 'yes') fields.forEach((c) => c.enable({ emitEvent: false }));
    else fields.forEach((c) => c.disable({ emitEvent: false }));
    this.error.set(null);
  }
}
