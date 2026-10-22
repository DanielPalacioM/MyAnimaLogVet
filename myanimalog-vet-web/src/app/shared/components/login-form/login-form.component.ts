import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { VetField } from '../form-field/form-field.component';
import { LoginCredentials } from '@services/login/login.models';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Presentacional: formulario del login (Figma 1828:2). No conoce servicios: emite eventos. */
@Component({
  selector: 'vet-login-form',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, VetField],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginForm {
  readonly loading = input(false);
  /** Error del intento anterior (credenciales, correo sin verificar…). */
  readonly error = input<string | null>(null);
  /** Aviso informativo (p. ej. función aún no disponible). */
  readonly notice = input<string | null>(null);

  readonly submitted = output<LoginCredentials>();
  readonly forgotPassword = output<void>();

  protected readonly showPassword = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', [Validators.required]],
  });
  protected readonly emailMessages = { pattern: 'Escribe un correo válido, por ejemplo tucorreo@clinica.com.' };

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.submitted.emit({ email: email.trim(), password });
  }
}
