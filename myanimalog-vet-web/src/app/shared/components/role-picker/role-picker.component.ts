import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MemberRole } from '@services/clinic/clinic.models';

export const ROLE_OPTIONS: { value: MemberRole; label: string; help: string }[] = [
  { value: 'ADMIN', label: 'Administrador', help: 'Configura la clínica, gestiona el equipo y ve los reportes.' },
  { value: 'VET', label: 'Veterinario', help: 'Atiende citas y escribe historia clínica cuando su tarjeta profesional esté verificada.' },
  { value: 'ASSISTANT', label: 'Auxiliar', help: 'Lee la historia clínica, registra enfermería y sube documentos.' },
  { value: 'RECEPTION', label: 'Recepción', help: 'Maneja la agenda y registra pacientes. Solo ve datos básicos.' },
];

/** Lista de roles con radio (Figma "Roles" del modal Invitar). */
@Component({
  selector: 'vet-role-picker',
  template: `
    <div role="radiogroup" [attr.aria-label]="label()">
      @for (r of options; track r.value) {
        <button type="button" role="radio" class="role" [class.on]="value() === r.value" [attr.aria-checked]="value() === r.value" (click)="value.set(r.value)">
          <span class="radio"><i></i></span>
          <span class="txt"><strong>{{ r.label }}</strong><small>{{ r.help }}</small></span>
        </button>
      }
    </div>
  `,
  styles: `
    div { display: flex; flex-direction: column; gap: 8px; }
    .role { display: flex; align-items: flex-start; gap: 12px; box-sizing: border-box; padding: 12px 14px; border: 1.5px solid #e6e4f5; border-radius: 10px; background: #fff; text-align: left; cursor: pointer; font-family: 'Afacad', sans-serif; }
    .role.on { border: 2px solid #4037be; background: #f7f6ff; padding: 11.5px 13.5px; }
    .role:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
    .radio { display: grid; flex: none; place-items: center; width: 18px; height: 18px; margin-top: 1px; box-sizing: border-box; border: 2px solid #b8b6cc; border-radius: 50%; background: #fff; }
    .on .radio { border-color: #4037be; }
    .radio i { display: none; width: 8px; height: 8px; border-radius: 50%; background: #4037be; }
    .on .radio i { display: block; }
    .txt { display: flex; flex-direction: column; gap: 2px; }
    strong { color: #1a1a2e; font: 700 14px/1.3 'Afacad', sans-serif; }
    small { color: #404040; font: 500 12px/1.35 'Afacad', sans-serif; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePicker {
  readonly value = model.required<MemberRole>();
  readonly label = input('Rol');
  protected readonly options = ROLE_OPTIONS;
}
