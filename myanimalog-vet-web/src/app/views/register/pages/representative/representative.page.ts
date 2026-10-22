import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { ChoiceOption } from '@shared/components/choice-cards/choice-cards.component';
import { IdDocumentType, YesNo } from '@services/register/models/registration.model';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { focusFirstInvalid } from '@shared/utils/focus-first-invalid';
import { digitsOnly, documentNumberValidator, fullNameValidator } from '@shared/validators/common';

/** Container: Paso 3 · Representante legal (Figma 1902:215). Debe coincidir con la cédula y la Cámara de Comercio. */
@Component({
  selector: 'vet-representative-page',
  standalone: false,
  templateUrl: './representative.page.html',
  styleUrl: './representative.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepresentativePage {
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly options: readonly ChoiceOption<YesNo>[] = [
    { value: 'yes', label: 'Sí, soy yo' },
    { value: 'no', label: 'No, es otra persona' },
  ];
  protected readonly documentTypes: readonly { value: IdDocumentType; label: string }[] = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PPT', label: 'Permiso por protección temporal' },
  ];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    isSelf: [this.store.draft().legalRep.isSelf as YesNo | null, [Validators.required]],
    fullName: [this.store.draft().legalRep.fullName, [Validators.required, fullNameValidator]],
    documentType: [this.store.draft().legalRep.documentType as IdDocumentType, [Validators.required]],
    documentNumber: [this.store.draft().legalRep.documentNumber, [Validators.required, documentNumberValidator]],
  });

  protected readonly messages = { isSelf: { required: 'Elige una opción.' } };

  constructor() {
    const { isSelf, fullName, documentNumber } = this.form.controls;
    isSelf.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const accountName = this.store.draft().account.fullName;
      // "Si eres tú, los llenamos con los datos de tu cuenta" (Figma). Sigue siendo editable: debe coincidir con la cédula.
      if (value === 'yes' && !fullName.value) fullName.setValue(accountName);
      if (value === 'no' && fullName.value === accountName) fullName.setValue('');
    });
    documentNumber.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const clean = digitsOnly(value ?? '').slice(0, 12);
      if (clean !== value) documentNumber.setValue(clean, { emitEvent: false });
    });
  }

  protected invalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected back(): void {
    this.nav.back('representative');
  }

  protected next(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const v = this.form.getRawValue();
    this.store.patch('legalRep', {
      isSelf: v.isSelf,
      fullName: v.fullName.trim(),
      documentType: v.documentType,
      documentNumber: v.documentNumber,
    });
    this.store.markComplete('representative');
    this.nav.next('representative');
  }
}
