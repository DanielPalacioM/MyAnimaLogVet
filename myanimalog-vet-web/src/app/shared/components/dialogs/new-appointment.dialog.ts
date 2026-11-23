import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { startWith } from 'rxjs';
import { errorMessage } from '@services/api-error';
import { Appointment } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { at, isoDate, startOfDay } from '@services/clinic/date.utils';
import { VetField } from '../form-field/form-field.component';

export interface NewAppointmentData {
  patientId?: string;
  /** Día inicial (ms). */
  day?: number;
  /** Si viene, el diálogo reprograma esa cita (solo cambia fecha y hora). */
  reschedule?: Appointment;
}

const SLOTS = Array.from({ length: 18 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Diálogo "Nueva cita": paciente → servicio → profesional → fecha y hora libre (DISENO §10). También reprograma. */
@Component({
  selector: 'vet-new-appointment-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, VetField],
  template: `
    <h2 mat-dialog-title>{{ reschedule ? 'Reprogramar cita' : 'Nueva cita' }}</h2>
    @if (blocker(); as why) {
      <mat-dialog-content class="content"><p class="reg-alert reg-alert--error" role="alert">{{ why }}</p></mat-dialog-content>
      <mat-dialog-actions align="end"><button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cerrar</button></mat-dialog-actions>
    } @else {
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="content">
        <vet-field label="Paciente" for="na-patient" [control]="form.controls.patient" [messages]="{ unknown: 'Elige un paciente de la lista.' }">
          <input id="na-patient" class="vet-input" list="na-patients" formControlName="patient" placeholder="Nombre de la mascota" autocomplete="off" />
          <datalist id="na-patients">
            @for (p of patientOptions(); track p.id) {
              <option [value]="p.name + ' · ' + p.owner"></option>
            }
          </datalist>
        </vet-field>

        <div class="row">
          <vet-field label="Servicio" for="na-service" [control]="form.controls.service">
            <select id="na-service" class="vet-input" formControlName="service">
              @for (s of store.services; track s.id) {
                <option [value]="s.id">{{ s.name }} ({{ s.minutes }} min)</option>
              }
            </select>
          </vet-field>
          <vet-field label="Profesional" for="na-prof" [control]="form.controls.professional">
            <select id="na-prof" class="vet-input" formControlName="professional">
              @for (p of professionals(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </vet-field>
        </div>

        <div class="row">
          <vet-field label="Fecha" for="na-date" [control]="form.controls.date">
            <input id="na-date" class="vet-input" type="date" formControlName="date" [min]="today" />
          </vet-field>
          <vet-field label="Hora" for="na-time" [control]="form.controls.time" hint="Solo se muestran horas libres">
            <select id="na-time" class="vet-input" formControlName="time">
              @for (slot of slots(); track slot.value) {
                <option [value]="slot.value" [disabled]="slot.busy">{{ slot.label }}@if (slot.busy) { · ocupada }</option>
              }
            </select>
          </vet-field>
        </div>

        @if (!reschedule) {
          <vet-field label="Nota (opcional)" for="na-note" [control]="form.controls.note">
            <input id="na-note" class="vet-input" formControlName="note" maxlength="300" placeholder="Ej. Trae el carné de vacunas" autocomplete="off" />
          </vet-field>
        }

        @if (error()) {
          <p class="reg-alert reg-alert--error" role="alert">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cancelar</button>
        <button type="submit" class="vet-btn vet-btn--primary" [disabled]="saving()">{{ reschedule ? 'Reprogramar' : 'Agendar cita' }}</button>
      </mat-dialog-actions>
    </form>
    }
  `,
  styles: `
    .content { display: flex; flex-direction: column; gap: 12px; min-width: min(440px, 80vw); padding: 8px 24px 12px !important; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    mat-dialog-actions { padding: 8px 24px 20px; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class NewAppointmentDialog {
  protected readonly store = inject(ClinicStore);
  private readonly ref = inject<MatDialogRef<NewAppointmentDialog, boolean>>(MatDialogRef);
  private readonly data = inject<NewAppointmentData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly reschedule = this.data?.reschedule ?? null;
  protected readonly today = isoDate(Date.now());
  protected readonly error = signal('');
  protected readonly saving = signal(false);

  /** Sin servicios o sin pacientes no hay nada que agendar: se explica en vez de abrir un formulario roto. */
  protected readonly blocker = computed(() => {
    if (this.store.catalogState() === 'error') return 'No pudimos cargar los servicios de la clínica. Cierra e inténtalo de nuevo.';
    if (!this.store.services.length) return 'La clínica no tiene servicios reservables en línea. Agrega uno en “Servicios y horarios” cuando el catálogo esté disponible.';
    if (!this.store.patients().length && !this.reschedule) return 'Todavía no hay pacientes: aparecen cuando un dueño comparte su mascota con la clínica.';
    if (!this.store.professionals.length) return 'No hay profesionales activos en el equipo.';
    return '';
  });

  private readonly initial = this.store.patient(this.reschedule?.patientId ?? this.data?.patientId ?? '');
  private readonly firstService = this.store.services.find((s) => s.id === this.reschedule?.serviceId) ?? this.store.services[0];
  protected readonly form = inject(FormBuilder).nonNullable.group({
    patient: [this.initial ? `${this.initial.name} · ${this.initial.owner}` : (this.reschedule?.patientName ?? ''), [Validators.required]],
    service: [this.firstService?.id ?? '', [Validators.required]],
    professional: [this.reschedule?.professionalId ?? this.pros(this.firstService?.id)[0]?.id ?? '', [Validators.required]],
    date: [isoDate(this.reschedule?.start ?? this.data?.day ?? Date.now()), [Validators.required]],
    time: ['', [Validators.required]],
    note: [''],
  });

  private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  private readonly service = computed(() => this.store.services.find((s) => s.id === this.values().service) ?? this.store.services[0]);
  protected readonly patientOptions = computed(() => this.store.patients().slice(0, 400));
  protected readonly professionals = computed(() => this.pros(this.service()?.id));

  protected readonly slots = computed(() => {
    const v = this.values();
    const day = startOfDay(new Date(`${v.date}T00:00:00`).getTime());
    const minutes = this.service()?.minutes ?? 30;
    const now = this.store.now();
    return SLOTS.map((value) => {
      const start = at(day, value);
      const [h, m] = value.split(':').map(Number);
      const busy =
        start < now ||
        !!this.store.unavailableReason(start, minutes, v.professional) ||
        this.store.hasConflict(v.professional ?? '', start, minutes, this.reschedule?.id);
      return { value, busy, label: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}` };
    });
  });

  constructor() {
    if (this.reschedule) {
      // Reprogramar solo cambia el momento: lo demás queda como estaba.
      this.form.controls.patient.disable();
      this.form.controls.service.disable();
      this.form.controls.professional.disable();
    }
    // Si el servicio cambia y el profesional ya no lo presta, se elige otro.
    this.form.controls.service.valueChanges.subscribe(() => {
      const list = this.professionals();
      if (!list.some((p) => p.id === this.form.controls.professional.value)) this.form.controls.professional.setValue(list[0]?.id ?? '');
      this.form.controls.time.setValue('');
    });
    this.form.controls.professional.valueChanges.subscribe(() => this.form.controls.time.setValue(''));
    this.form.controls.date.valueChanges.subscribe(() => this.form.controls.time.setValue(''));
  }

  /** Quienes prestan el servicio. Si el catálogo no dice quién lo presta, pueden todos los que atienden. */
  private pros(serviceId: string | undefined) {
    const service = this.store.services.find((s) => s.id === serviceId);
    const all = this.store.professionals;
    return service?.professionalIds.length ? all.filter((p) => service.professionalIds.includes(p.id)) : all;
  }

  protected save(): void {
    this.error.set('');
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const patient = this.reschedule
      ? { id: this.reschedule.patientId }
      : this.store.patients().find((p) => `${p.name} · ${p.owner}` === v.patient);
    if (!patient) {
      this.form.controls.patient.setErrors({ unknown: true });
      return;
    }
    if (this.form.invalid) return;
    const service = this.service();
    const start = at(startOfDay(new Date(`${v.date}T00:00:00`).getTime()), v.time);
    if (this.store.hasConflict(v.professional, start, service.minutes, this.reschedule?.id)) {
      this.error.set('Ese horario ya no está libre. Elige otro.');
      return;
    }
    this.saving.set(true);
    const request = this.reschedule
      ? this.store.reschedule(this.reschedule.id, start)
      : this.store.addAppointment({
          patientId: patient.id,
          service: service.name,
          serviceId: service.id,
          professionalId: v.professional,
          start,
          minutes: service.minutes,
          note: v.note.trim() || undefined,
        });
    request.subscribe({
      next: () => this.ref.close(true),
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
      // `addAppointment` emite una vez y completa; si no hubiera clínica (EMPTY) no se queda cargando.
      complete: () => this.saving.set(false),
    });
  }
}
