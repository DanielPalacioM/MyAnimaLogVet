import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { errorMessage } from '@services/api-error';
import { ClinicProfileService } from '@services/clinic-profile/clinic-profile.service';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';
import { downloadQr } from '@shared/components/qr/download-qr';
import { startWith } from 'rxjs';

const phoneValid = (c: { value: string }) => (/^\+?[\d\s]{7,16}$/.test(c.value.trim()) ? null : { phone: { message: 'Escribe un teléfono válido, por ejemplo +57 300 123 4567.' } });

const STATUS_LABEL: Record<string, string> = {
  PENDING_DOCUMENTS: 'Pendiente de documentos',
  UNDER_REVIEW: 'En revisión',
  NEEDS_CORRECTION: 'Requiere corrección',
  REJECTED: 'No aprobada',
  SUSPENDED: 'Suspendida',
  ACTIVE: 'Verificada',
};

/** Mi clínica (Figma 1972:225): perfil público, reservas en línea, código de vinculación y datos legales. */
@Component({
  selector: 'vet-clinic-page',
  standalone: false,
  templateUrl: './clinic.page.html',
  styleUrl: './clinic.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicPage implements OnInit {
  protected readonly svc = inject(ClinicProfileService);
  protected readonly store = inject(ClinicStore);
  private readonly actions = inject(PanelActionsService);
  private readonly preview = viewChild<ElementRef<HTMLElement>>('preview');

  protected readonly durations = [15, 20, 30, 45, 60];
  protected readonly highlight = signal(false);
  protected readonly logoError = signal('');
  protected readonly uploading = signal(false);
  protected readonly saving = signal(false);
  protected readonly busyCode = signal(false);

  protected readonly status = computed(() => this.store.profile()?.status ?? '');
  protected readonly statusLabel = computed(() => STATUS_LABEL[this.status()] ?? this.status());
  protected readonly verified = computed(() => this.status() === 'ACTIVE');
  protected readonly logo = computed(() => this.store.profile()?.logoUrl ?? null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, phoneValid]],
    email: ['', [Validators.required, Validators.email]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    onlineBooking: [false],
    confirmEach: [false],
    minCancelHours: [4],
    defaultMinutes: [30],
    inDirectory: [false],
  });
  protected readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  protected readonly initial = computed(() => this.svc.initial(this.values().name ?? ''));
  protected readonly cityShort = computed(() => (this.values().city ?? '').split(',')[0]);
  protected readonly visibleCategories = computed(() => this.svc.onlineCategories().slice(0, 3));
  protected readonly extraCategories = computed(() => Math.max(0, this.svc.onlineCategories().length - 3));
  /** Opciones de anticipación: las habituales y, si el backend trae otra, esa también. */
  protected readonly cancelOptions = computed(() => [...new Set([1, 2, 4, 12, 24, 48, this.values().minCancelHours ?? 4])].sort((a, b) => a - b));

  constructor() {
    // Cuando llegan (o se recargan) los datos de la clínica, el formulario se llena, salvo que haya cambios sin guardar.
    effect(() => {
      const p = this.store.profile();
      if (!p) return;
      untracked(() => {
        if (this.form.dirty) return;
        this.form.reset({
          name: p.name,
          phone: p.phone,
          email: p.email,
          city: p.city,
          onlineBooking: p.onlineBooking,
          confirmEach: p.confirmEach,
          minCancelHours: p.minCancelHours,
          defaultMinutes: p.defaultMinutes,
          inDirectory: p.inDirectory,
        });
      });
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.store.loadProfile().subscribe();
  }

  protected err(name: 'name' | 'phone' | 'email' | 'city'): string {
    const c = this.form.controls[name];
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Este campo es obligatorio.';
    if (c.errors['email']) return 'Escribe un correo válido, por ejemplo hola@clinica.co.';
    if (c.errors['phone']) return c.errors['phone'].message;
    return name === 'name' ? 'Escribe al menos 3 letras.' : 'Escribe al menos 2 letras.';
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
    if (!this.form.dirty) {
      this.actions.toast('No hay cambios por guardar.');
      return;
    }
    const current = this.store.profile()!;
    const v = this.form.getRawValue();
    // Solo se manda lo que cambió.
    const patch = Object.fromEntries(
      Object.entries({
        name: v.name.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        city: v.city.trim(),
        onlineBooking: v.onlineBooking,
        confirmEach: v.confirmEach,
        minCancelHours: Number(v.minCancelHours),
        defaultMinutes: Number(v.defaultMinutes),
        inDirectory: v.inDirectory,
      }).filter(([k, val]) => (current as unknown as Record<string, unknown>)[k] !== val),
    );
    this.saving.set(true);
    this.store.updateProfile(patch).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.actions.toast('Cambios guardados');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.actions.toast(errorMessage(e));
      },
    });
  }

  protected seeAsOwner(): void {
    this.preview()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.highlight.set(true);
    setTimeout(() => this.highlight.set(false), 1800);
  }

  protected pickLogo(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.logoError.set('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return this.logoError.set('El logo debe ser PNG, JPG o WEBP.');
    if (file.size > 2 * 1024 * 1024) return this.logoError.set('El logo pesa más de 2 MB.');
    this.uploading.set(true);
    this.store.uploadLogo(file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.actions.toast('Logo actualizado');
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.logoError.set(errorMessage(err));
      },
    });
  }

  protected removeLogo(): void {
    this.uploading.set(true);
    this.store.removeLogo().subscribe({
      next: () => {
        this.uploading.set(false);
        this.actions.toast('Logo quitado');
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.actions.toast(errorMessage(err));
      },
    });
  }

  protected download(code: string): void {
    downloadQr(code);
    this.actions.toast('QR descargado');
  }

  protected regenerate(): void {
    const run = () => {
      this.busyCode.set(true);
      this.store.generateLinkCode().subscribe({
        next: (code) => {
          this.busyCode.set(false);
          this.actions.toast(`Código nuevo: ${code}`);
        },
        error: (e: unknown) => {
          this.busyCode.set(false);
          this.actions.toast(errorMessage(e));
        },
      });
    };
    if (!this.store.linkCode()) return run();
    this.actions
      .confirm({ title: '¿Generar un código nuevo?', message: 'El código actual deja de servir y el QR que tengas impreso ya no vincula. Los clientes ya vinculados se quedan.', confirmLabel: 'Generar código nuevo' })
      .subscribe((ok) => ok && run());
  }

  protected revoke(): void {
    this.actions
      .confirm({ title: '¿Revocar el código?', message: 'El código actual deja de servir. Los clientes ya vinculados se quedan. Puedes generar uno nuevo cuando quieras.', confirmLabel: 'Revocar código', danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.store.revokeLinkCode().subscribe({
          next: () => this.actions.toast('Código revocado'),
          error: (e: unknown) => this.actions.toast(errorMessage(e)),
        });
      });
  }
}
