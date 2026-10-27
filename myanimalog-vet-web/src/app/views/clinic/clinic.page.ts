import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { SessionService } from '@auth/services/session.service';
import { ClinicProfileService } from '@services/clinic-profile/clinic-profile.service';
import { CITIES } from '@services/clinic/clinic-settings.seed';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';
import { downloadQr } from '@shared/components/qr/download-qr';
import { startWith } from 'rxjs';

const phoneValid = (c: { value: string }) => (/^\+?[\d\s]{7,16}$/.test(c.value.trim()) ? null : { phone: { message: 'Escribe un teléfono válido, por ejemplo +57 300 123 4567.' } });

/** Mi clínica (Figma 1972:225): perfil público, reservas en línea, código de vinculación y datos legales. */
@Component({
  selector: 'vet-clinic-page',
  standalone: false,
  templateUrl: './clinic.page.html',
  styleUrl: './clinic.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicPage {
  protected readonly svc = inject(ClinicProfileService);
  protected readonly store = inject(ClinicStore);
  private readonly session = inject(SessionService);
  private readonly actions = inject(PanelActionsService);
  private readonly preview = viewChild<ElementRef<HTMLElement>>('preview');

  protected readonly cities = CITIES;
  protected readonly cancelOptions = [1, 2, 4, 12, 24, 48];
  protected readonly durations = [15, 20, 30, 45, 60];
  protected readonly verified = computed(() => this.session.clinic()?.status === 'ACTIVE');
  protected readonly highlight = signal(false);
  protected readonly logo = signal<string | null>(null);
  protected readonly logoError = signal('');
  /** Posición del pin del mapa (porcentaje), editable arrastrándolo. */
  protected readonly pin = signal({ x: 46, y: 52 });
  protected readonly saved = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.store.profile().name, [Validators.required, Validators.minLength(3)]],
    phone: [this.store.profile().phone, [Validators.required, phoneValid]],
    email: [this.store.profile().email, [Validators.required, Validators.email]],
    city: [this.store.profile().city, [Validators.required]],
    address: [this.store.profile().address, [Validators.required, Validators.minLength(5)]],
    onlineBooking: [this.store.profile().onlineBooking],
    confirmEach: [this.store.profile().confirmEach],
    minCancelHours: [this.store.profile().minCancelHours],
    defaultMinutes: [this.store.profile().defaultMinutes],
    inDirectory: [this.store.profile().inDirectory],
  });
  protected readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  protected readonly initial = computed(() => this.svc.initial(this.values().name ?? ''));
  protected readonly cityShort = computed(() => (this.values().city ?? '').split(',')[0]);
  protected readonly visibleCategories = computed(() => this.svc.onlineCategories().slice(0, 3));
  protected readonly extraCategories = computed(() => Math.max(0, this.svc.onlineCategories().length - 3));

  protected err(name: 'name' | 'phone' | 'email' | 'address'): string {
    const c = this.form.controls[name];
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Este campo es obligatorio.';
    if (c.errors['email']) return 'Escribe un correo válido, por ejemplo hola@clinica.co.';
    if (c.errors['phone']) return c.errors['phone'].message;
    return name === 'name' ? 'Escribe al menos 3 letras.' : 'Escribe al menos 5 caracteres.';
  }

  protected set(control: 'onlineBooking' | 'confirmEach' | 'inDirectory', value: boolean): void {
    this.form.controls[control].setValue(value);
    this.form.markAsDirty();
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.actions.toast('Revisa los campos marcados antes de guardar.');
      return;
    }
    if (!this.form.dirty && !this.logo()) {
      this.actions.toast('No hay cambios por guardar.');
      return;
    }
    const v = this.form.getRawValue();
    this.store.updateProfile({ ...v, name: v.name.trim(), address: v.address.trim(), minCancelHours: Number(v.minCancelHours), defaultMinutes: Number(v.defaultMinutes) });
    this.form.markAsPristine();
    this.actions.toast('Cambios guardados');
  }

  protected seeAsOwner(): void {
    this.preview()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.highlight.set(true);
    setTimeout(() => this.highlight.set(false), 1800);
  }

  protected pickLogo(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    this.logoError.set('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return this.logoError.set('El logo debe ser PNG, JPG o WEBP.');
    if (file.size > 2 * 1024 * 1024) return this.logoError.set('El logo pesa más de 2 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      this.logo.set(String(reader.result));
      this.form.markAsDirty();
    };
    reader.readAsDataURL(file);
  }

  protected removeLogo(): void {
    this.logo.set(null);
    this.form.markAsDirty();
  }

  protected movePin(e: PointerEvent, map: HTMLElement): void {
    if (e.buttons !== 1) return;
    const r = map.getBoundingClientRect();
    this.pin.set({ x: Math.min(95, Math.max(5, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(90, Math.max(10, ((e.clientY - r.top) / r.height) * 100)) });
    this.form.markAsDirty();
  }

  protected download(code: string): void {
    downloadQr(code);
    this.actions.toast('QR descargado');
  }

  protected regenerate(): void {
    const has = !!this.store.linkCode();
    const run = () => this.actions.toast(`Código nuevo: ${this.store.regenerateLinkCode()}`);
    if (!has) return run();
    this.actions
      .confirm({ title: '¿Generar un código nuevo?', message: 'El código actual deja de servir y el QR que tengas impreso ya no vincula. Los clientes ya vinculados se quedan.', confirmLabel: 'Generar código nuevo' })
      .subscribe((ok) => ok && run());
  }

  protected revoke(): void {
    this.actions
      .confirm({ title: '¿Revocar el código?', message: 'El código actual deja de servir. Los clientes ya vinculados se quedan. Puedes generar uno nuevo cuando quieras.', confirmLabel: 'Revocar código', danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.revokeLinkCode();
        this.actions.toast('Código revocado');
      });
  }
}
