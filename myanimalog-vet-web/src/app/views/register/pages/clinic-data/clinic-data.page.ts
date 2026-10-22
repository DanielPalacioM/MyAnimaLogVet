import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { errorMessage } from '@services/api-error';
import { RegisterService } from '@services/register/register.service';
import { RegistrationStore } from '@services/register/registration.store';
import { StepNavigator } from '@services/register/step-navigator';
import { COLOMBIA_BOUNDS, DEPARTMENTS, locationValue, parseLocation } from '@services/register/models/colombia';
import { focusFirstInvalid } from '@shared/utils/focus-first-invalid';
import { digitsOnly, EMAIL_PATTERN, phoneValidator } from '@shared/validators/common';
import { LOGO_RULE, validateFile } from '@shared/validators/files';
import { nitDvValidator, nitFormatValidator } from '@shared/validators/nit';

/** Container: Paso 2 · Tu clínica (Figma 1901:132). Datos de la clínica, logo y ubicación. */
@Component({
  selector: 'vet-clinic-data-page',
  standalone: false,
  templateUrl: './clinic-data.page.html',
  styleUrl: './clinic-data.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicDataPage {
  private readonly api = inject(RegisterService);
  private readonly store = inject(RegistrationStore);
  private readonly nav = inject(StepNavigator);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly departments = DEPARTMENTS;
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);

  // Logo
  protected readonly logo = signal<File | null>(this.store.logo());
  protected readonly logoError = signal<string | null>(null);
  protected readonly logoPreview = computed(() => {
    const file = this.logo();
    return file ? URL.createObjectURL(file) : null;
  });

  // Ubicación (REGISTRO §2: guarda latitude y longitude)
  protected readonly coords = signal<{ lat: number; lng: number } | null>(this.initialCoords());
  protected readonly locating = signal(false);
  protected readonly locationError = signal<string | null>(null);

  protected readonly form = this.buildForm();

  constructor() {
    this.destroyRef.onDestroy(() => {
      const preview = this.logoPreview();
      if (preview) URL.revokeObjectURL(preview);
    });
    const { nit, nitDv, phone } = this.form.controls;
    // Solo dígitos en NIT, DV y teléfono (aunque peguen "900.123.456-8" o "+57 300…").
    this.keepDigits(nit, 9);
    this.keepDigits(nitDv, 1);
    this.keepDigits(phone, 10);
    // El DV depende del NIT: revalidar cuando este cambia.
    nit.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => nitDv.updateValueAndValidity());
  }

  protected invalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  // ---- Logo ----

  protected pickLogo(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    element.value = '';
    if (!file) return;
    const problem = validateFile(file, LOGO_RULE);
    this.logoError.set(problem);
    if (!problem) {
      this.logo.set(file);
      this.store.setLogo(file);
    }
  }

  protected removeLogo(): void {
    this.logo.set(null);
    this.logoError.set(null);
    this.store.setLogo(null);
  }

  // ---- Ubicación ----

  protected useMyLocation(): void {
    if (!('geolocation' in navigator)) {
      this.locationError.set('Tu navegador no permite obtener la ubicación.');
      return;
    }
    this.locating.set(true);
    this.locationError.set(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.locating.set(false);
        const { latitude: lat, longitude: lng } = coords;
        const b = COLOMBIA_BOUNDS;
        if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
          this.locationError.set('La ubicación está fuera de Colombia. Ubícate en la clínica e inténtalo de nuevo.');
          return;
        }
        this.coords.set({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      },
      (e) => {
        this.locating.set(false);
        this.locationError.set(
          e.code === e.PERMISSION_DENIED
            ? 'Permite el acceso a tu ubicación en el navegador para marcarla.'
            : 'No pudimos obtener tu ubicación. Inténtalo de nuevo.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected clearLocation(): void {
    this.coords.set(null);
  }

  // ---- Navegación ----

  protected back(): void {
    this.nav.back('clinic');
  }

  protected next(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const v = this.form.getRawValue();
    this.checking.set(true);
    this.error.set(null);
    this.api.checkClinicAvailability({ name: v.name, nit: v.nit, email: v.email }).subscribe({
      next: (taken) => {
        this.checking.set(false);
        const { name, nit, email } = this.form.controls;
        if (taken.nameTaken) name.setErrors({ taken: { message: 'Ya existe una clínica con este nombre.' } });
        if (taken.nitTaken) nit.setErrors({ taken: { message: 'Este NIT ya está registrado.' } });
        if (taken.emailTaken) email.setErrors({ taken: { message: 'Este correo ya está registrado en otra clínica.' } });
        if (taken.nameTaken || taken.nitTaken || taken.emailTaken) {
          this.form.markAllAsTouched();
          focusFirstInvalid(this.host.nativeElement);
          return;
        }
        this.save();
      },
      error: (e: unknown) => {
        this.checking.set(false);
        this.error.set(errorMessage(e, 'No pudimos validar los datos. Inténtalo de nuevo.'));
      },
    });
  }

  private save(): void {
    const v = this.form.getRawValue();
    const { department, city } = parseLocation(v.location);
    const coords = this.coords();
    this.store.patch('clinic', {
      name: v.name.trim(),
      legalName: v.legalName.trim(),
      nit: v.nit,
      nitDv: v.nitDv,
      phone: v.phone,
      email: v.email.trim().toLowerCase(),
      department,
      city,
      address: v.address.trim(),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    });
    this.store.markComplete('clinic');
    this.nav.next('clinic');
  }

  // ---- Auxiliares ----

  private buildForm() {
    const c = this.store.draft().clinic;
    return inject(FormBuilder).nonNullable.group({
      name: [c.name, [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      legalName: [c.legalName, [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
      nit: [c.nit, [Validators.required, nitFormatValidator]],
      nitDv: [c.nitDv, [Validators.required, nitDvValidator]],
      phone: [c.phone, [Validators.required, phoneValidator]],
      email: [c.email, [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
      location: [locationValue(c.department, c.city), [Validators.required]],
      address: [c.address, [Validators.required, Validators.minLength(5), Validators.maxLength(150)]],
    });
  }

  private initialCoords(): { lat: number; lng: number } | null {
    const { latitude, longitude } = this.store.draft().clinic;
    return latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;
  }

  private keepDigits(control: AbstractControl, max: number): void {
    control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value: string) => {
      const clean = digitsOnly(value ?? '').slice(0, max);
      if (clean !== value) control.setValue(clean, { emitEvent: false });
    });
  }

  protected readonly messages = {
    name: { minlength: 'Escribe el nombre comercial completo.' },
    email: { pattern: 'Escribe un correo válido, por ejemplo clinica@correo.com.' },
    location: { required: 'Selecciona el departamento y la ciudad.' },
  };
}
