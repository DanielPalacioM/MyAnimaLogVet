import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiError, errorMessage } from '@services/api-error';
import { ClientDto } from '@services/api/link.api';
import { Appointment, Patient } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { at, longDate, startOfDay, timeLabel } from '@services/clinic/date.utils';
import { PickSlot, PickSlotDialog, PickSlotData, PickSlotResult } from './pick-slot.dialog';

export interface NewAppointmentData {
  patientId?: string;
  /** Día inicial (ms). */
  day?: number;
  /** Si viene, el diálogo reprograma esa cita (solo cambia fecha y hora). */
  reschedule?: Appointment;
}

/**
 * Horario de guía mientras la clínica no tiene horario publicado (VET-32): lunes a viernes 8–12 y 14–18, sábado 8–12,
 * domingo cerrado (el mismo de la app del dueño). El servidor manda: si la hora no sirve, responde `SLOT_UNAVAILABLE`
 * y esa hora queda marcada como no disponible.
 */
const WEEKDAY_RANGES: [string, string][] = [['08:00', '12:00'], ['14:00', '18:00']];
const GUIDE: Record<number, [string, string][]> = { 0: [], 1: WEEKDAY_RANGES, 2: WEEKDAY_RANGES, 3: WEEKDAY_RANGES, 4: WEEKDAY_RANGES, 5: WEEKDAY_RANGES, 6: [['08:00', '12:00']] };
const CANDIDATES = Array.from({ length: 26 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Diálogo "Nueva cita": paciente, servicio, quién atiende y, en una sub-ventana, fecha y hora. También reprograma. */
@Component({
  selector: 'vet-new-appointment-dialog',
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ reschedule ? 'Reprogramar cita' : 'Nueva cita' }}</h2>
    @if (blocker(); as why) {
      <mat-dialog-content class="content"><p class="reg-alert reg-alert--error" role="alert">{{ why }}</p></mat-dialog-content>
      <mat-dialog-actions align="end"><button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cerrar</button></mat-dialog-actions>
    } @else {
      <mat-dialog-content class="content">
        @if (reschedule) {
          <div class="moving">
            <strong>{{ reschedule.service }} · {{ reschedule.patientName }}</strong>
            <small>Hoy está el {{ longDate(reschedule.start) }} a las {{ clock(reschedule.start) }}</small>
          </div>
        } @else {
          <div class="field">
            <label for="na-patient">Paciente</label>
            <input id="na-patient" class="vet-input" placeholder="Escribe el nombre de la mascota o del cuidador" autocomplete="off"
                   [value]="patientText()" (focus)="patientOpen.set(true)" (input)="setPatient($any($event.target).value)" />
            @if (patientOpen() && !patientId()) {
              <ul class="menu" role="listbox" aria-label="Pacientes">
                @for (p of patientOptions(); track p.id) {
                  <li class="item">
                    <button type="button" class="pick" (click)="choosePatient(p.id)">
                      <span class="pet-av">{{ p.name.charAt(0) }}</span>
                      <span class="txt"><strong>{{ p.name }}</strong><small>Cuidador: &#64;{{ keeperOf(p) }}</small></span>
                    </button>
                    <button type="button" class="dots" [attr.aria-expanded]="infoId() === p.id" aria-label="Ver datos del cuidador" (click)="toggleInfo(p.id)">⋯</button>
                    @if (infoId() === p.id) {
                      <dl class="info">
                        <dt>Cuidador</dt><dd>{{ p.owner }}</dd>
                        <dt>Correo</dt><dd>{{ emailOf(p) || 'Sin correo' }}</dd>
                        <dt>Teléfono</dt><dd>{{ p.phone || 'Sin teléfono' }}</dd>
                        <dt>Mascota</dt><dd>{{ p.breed || p.species }}</dd>
                      </dl>
                    }
                  </li>
                } @empty {
                  <li class="none">No hay pacientes con ese nombre.</li>
                }
              </ul>
            }
          </div>

          <div class="field">
            <label for="na-service">Servicio</label>
            <input id="na-service" class="vet-input" placeholder="Escribe para buscar un servicio" autocomplete="off"
                   [value]="serviceText()" (focus)="serviceOpen.set(true)" (input)="setService($any($event.target).value)" />
            @if (serviceOpen() && !serviceId()) {
              <ul class="menu menu--tags" role="listbox" aria-label="Servicios">
                @for (s of serviceOptions(); track s.id) {
                  <li><button type="button" class="tag" (click)="chooseService(s.id)">{{ s.name }}<small>{{ s.minutes }} min</small></button></li>
                } @empty {
                  <li class="none">Ningún servicio coincide con “{{ serviceText() }}”.</li>
                }
              </ul>
            }
          </div>

          <div class="field">
            <span class="lbl">Quién atiende</span>
            <div class="pros" role="radiogroup" aria-label="Quién atiende">
              @for (p of professionals(); track p.id) {
                <button type="button" class="pro" role="radio" [class.on]="p.id === professionalId()" [attr.aria-checked]="p.id === professionalId()" (click)="setProfessional(p.id)">
                  <span class="avatar" [style.background]="p.color">{{ p.initials }}</span>
                  <span class="txt"><strong>{{ shortName(p.name) }}</strong><small>{{ p.role }}</small></span>
                </button>
              } @empty {
                <p class="none">Primero elige un servicio.</p>
              }
            </div>
          </div>
        }

        <div class="field">
          <label for="na-when">Fecha y hora</label>
          <button id="na-when" type="button" class="when" [class.empty]="!time()" (click)="openPicker()">
            <span>{{ time() ? whenLabel() : 'Elegir fecha y hora' }}</span>
            <span aria-hidden="true">📅</span>
          </button>
        </div>

        @if (!reschedule) {
          <div class="field">
            <label for="na-note">Nota (opcional)</label>
            <input id="na-note" class="vet-input" [value]="note()" (input)="note.set($any($event.target).value)" maxlength="300" placeholder="Ej. Trae el carné de vacunas" autocomplete="off" />
          </div>
        }

        @if (error()) {
          <p class="reg-alert reg-alert--error" role="alert">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cancelar</button>
        <button type="button" class="vet-btn vet-btn--primary" [disabled]="saving()" (click)="save()">{{ reschedule ? 'Reprogramar' : 'Agendar cita' }}</button>
      </mat-dialog-actions>
    }
  `,
  styles: `
    .content { display: flex; flex-direction: column; gap: 12px; width: min(480px, 86vw); box-sizing: border-box; padding: 8px 24px 12px !important; overflow-x: hidden; }
    mat-dialog-actions { padding: 8px 24px 20px; gap: 8px; }
    .field { display: grid; gap: 6px; min-width: 0; }
    .field label, .lbl { font-weight: 700; font-size: 14px; color: var(--vet-text); }
    .txt { display: grid; min-width: 0; text-align: left; }
    .txt strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .txt small { color: #6b6b80; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .none { color: #6b6b80; font-size: 14px; padding: 8px 4px; list-style: none; }
    .menu { list-style: none; margin: 0; padding: 4px; border: 1.5px solid #e4e2f4; border-radius: 14px; background: #fff; max-height: 230px; overflow-y: auto; display: grid; gap: 2px; }
    .item { display: grid; grid-template-columns: 1fr auto; align-items: center; border-radius: 10px; }
    .item:hover { background: var(--vet-soft); }
    .pick { display: flex; align-items: center; gap: 10px; min-width: 0; background: transparent; border: none; padding: 8px 10px; cursor: pointer; font: inherit; color: var(--vet-text); }
    .pet-av { flex: 0 0 34px; height: 34px; border-radius: 50%; background: var(--vet-primary); color: #fff; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; text-transform: uppercase; }
    .dots { width: 36px; height: 36px; margin-right: 4px; border: none; border-radius: 50%; background: transparent; color: #6b6b80; font-size: 22px; line-height: 1; cursor: pointer; }
    .dots:hover, .dots[aria-expanded='true'] { background: #e4e2f4; color: var(--vet-primary); }
    .info { grid-column: 1 / -1; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 10px 8px; padding: 10px 12px; background: #f7f6ff; border-radius: 10px; font-size: 13px; }
    .info dt { color: #6b6b80; }
    .info dd { margin: 0; overflow-wrap: anywhere; }
    .menu--tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; }
    .menu--tags li { list-style: none; }
    .tag { display: inline-flex; align-items: baseline; gap: 6px; border: 1.5px solid var(--vet-primary); background: #fff; color: var(--vet-primary); border-radius: 999px; padding: 6px 14px; font: inherit; font-weight: 700; cursor: pointer; }
    .tag small { font-weight: 400; color: #6b6b80; }
    .tag:hover { background: var(--vet-soft); }
    .pros { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
    .pro { display: flex; align-items: center; gap: 10px; min-width: 0; background: #fff; border: 1.5px solid #e4e2f4; border-radius: 14px; padding: 8px 12px 8px 8px; cursor: pointer; font: inherit; color: var(--vet-text); }
    .pro:hover { border-color: var(--vet-primary); }
    .pro.on { border-color: var(--vet-primary); background: var(--vet-soft); box-shadow: 0 0 0 1px var(--vet-primary); }
    .avatar { flex: 0 0 34px; height: 34px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; }
    .chosen { display: flex; align-items: center; gap: 8px; }
    .field input, .field select { width: 100%; box-sizing: border-box; }
    .hint { color: #6b6b80; font-size: 12.5px; }
    .when { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; box-sizing: border-box; text-align: left; background: #fff; border: 1.5px solid #e4e2f4; border-radius: 12px; padding: 11px 14px; font: inherit; color: var(--vet-text); cursor: pointer; }
    .when:hover, .when:focus-visible { border-color: var(--vet-primary); outline: none; }
    .when.empty { color: #6b6b80; }
    .moving { background: #fff4e0; border-radius: 12px; padding: 10px 14px; display: grid; gap: 2px; }
    .moving small { color: #8a5a00; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class NewAppointmentDialog {
  protected readonly store = inject(ClinicStore);
  private readonly ref = inject<MatDialogRef<NewAppointmentDialog, boolean>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly data = inject<NewAppointmentData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly reschedule = this.data?.reschedule ?? null;
  protected readonly longDate = longDate;
  protected readonly clock = timeLabel;
  protected readonly error = signal('');
  protected readonly saving = signal(false);

  private readonly initialPatient = this.store.patient(this.reschedule?.patientId ?? this.data?.patientId ?? '');
  private readonly initialService = this.store.services.find((s) => s.id === this.reschedule?.serviceId);
  protected readonly patientId = signal(this.initialPatient?.id ?? '');
  protected readonly patientText = signal('');
  protected readonly serviceId = signal(this.initialService?.id ?? '');
  protected readonly serviceText = signal(this.initialService?.name ?? '');
  protected readonly professionalId = signal(this.reschedule?.professionalId ?? '');
  protected readonly day = signal(startOfDay(Math.max(this.reschedule?.start ?? this.data?.day ?? Date.now(), startOfDay(Date.now()))));
  protected readonly time = signal('');
  protected readonly note = signal('');
  /** Horas que el servidor rechazó (`profesional|inicio`): no se vuelven a ofrecer. */
  private readonly rejected = signal<ReadonlySet<string>>(new Set());

  /** Sin servicios o sin pacientes no hay nada que agendar: se explica en vez de abrir un formulario roto. */
  protected readonly blocker = computed(() => {
    if (this.store.catalogState() === 'error') return 'No pudimos cargar los servicios de la clínica. Cierra e inténtalo de nuevo.';
    if (!this.store.services.length) return 'La clínica no tiene servicios reservables en línea. Agrega uno en “Servicios y horarios” cuando el catálogo esté disponible.';
    if (!this.store.patients().length && !this.reschedule) return 'Todavía no hay pacientes: aparecen cuando un dueño comparte su mascota con la clínica.';
    if (!this.store.professionals.length) return 'No hay profesionales activos en el equipo.';
    return '';
  });

  protected readonly patientOptions = computed(() => {
    const q = this.patientText().trim().toLowerCase();
    const all = this.store.patients();
    return (q ? all.filter((p) => `${p.name} ${p.owner} ${this.emailOf(p)}`.toLowerCase().includes(q)) : all).slice(0, 60);
  });
  protected readonly service = computed(() => this.store.services.find((s) => s.id === this.serviceId()));
  protected readonly professionals = computed(() => {
    const service = this.service();
    const all = this.store.professionals;
    if (service?.professionalIds.length) return all.filter((p) => service.professionalIds.includes(p.id));
    // Catálogo de Veterinary: lo prestan los roles permitidos (y con tarjeta verificada si el servicio lo exige).
    if (service?.allowedRoles?.length) {
      const ok = new Set(
        this.store.members().filter((m) => service.allowedRoles!.includes(m.role) && (!service.requiresLicense || m.license === 'VERIFIED')).map((m) => m.id),
      );
      return all.filter((p) => ok.has(p.id));
    }
    return all;
  });
  private readonly minutes = computed(() => this.service()?.minutes ?? this.reschedule?.minutes ?? 30);
  protected readonly whenLabel = computed(() => `${longDate(this.day())} · ${this.time() ? this.timeText(this.time()) : ''}`);

  constructor() {
    if (!this.reschedule) this.professionalId.set(this.professionals()[0]?.id ?? '');
    if (this.initialPatient) this.patientText.set(`${this.initialPatient.name} · @${this.keeperOf(this.initialPatient)}`);
  }

  protected money(v: number): string {
    return `$${Math.round(v).toLocaleString('es-CO')}`;
  }

  private timeText(value: string): string {
    return timeLabel(at(this.day(), value));
  }

  protected readonly patientOpen = signal(false);
  protected readonly serviceOpen = signal(false);
  protected readonly infoId = signal('');

  private clientOf(p: Patient): ClientDto | undefined {
    return this.store.clientList().find((c) => c.userId === p.ownerId);
  }

  protected emailOf(p: Patient): string {
    return this.clientOf(p)?.email ?? '';
  }

  /** Usuario del cuidador: su nombre de usuario si lo hay, si no la parte del correo antes de la @. */
  protected keeperOf(p: Patient): string {
    const c = this.clientOf(p);
    const base = c?.name?.trim() || c?.email?.split('@')[0] || p.owner.split('@')[0];
    return base.replace(/\s+/g, '_').toLowerCase();
  }

  /** Un correo largo como nombre no cabe: se muestra solo lo anterior a la @. */
  protected shortName(name: string): string {
    return name.includes('@') ? name.split('@')[0] : name;
  }

  protected toggleInfo(id: string): void {
    this.infoId.set(this.infoId() === id ? '' : id);
  }

  /** Al escribir se filtra la lista; elegir uno cierra el menú. */
  protected setPatient(text: string): void {
    this.patientText.set(text);
    this.patientId.set('');
    this.patientOpen.set(true);
  }

  protected choosePatient(id: string): void {
    const p = this.store.patient(id);
    if (!p) return;
    this.patientId.set(id);
    this.patientText.set(`${p.name} · @${this.keeperOf(p)}`);
    this.patientOpen.set(false);
    this.infoId.set('');
  }

  protected setService(text: string): void {
    this.serviceText.set(text);
    this.serviceId.set('');
    this.serviceOpen.set(true);
    this.time.set('');
  }

  protected readonly serviceOptions = computed(() => {
    const q = this.serviceText().trim().toLowerCase();
    const all = this.store.services;
    return q ? all.filter((s) => `${s.name} ${s.category}`.toLowerCase().includes(q)) : all;
  });

  protected chooseService(id: string): void {
    const s = this.store.services.find((x) => x.id === id);
    if (!s) return;
    this.serviceId.set(id);
    this.serviceText.set(s.name);
    this.serviceOpen.set(false);
    if (!this.professionals().some((p) => p.id === this.professionalId())) this.professionalId.set(this.professionals()[0]?.id ?? '');
    this.time.set('');
  }

  protected setProfessional(id: string): void {
    this.professionalId.set(id);
    this.time.set('');
  }

  /** Horas de un día: las del horario (publicado o de guía), marcando las ocupadas, pasadas o rechazadas. */
  private slotsOf(dayStart: number): PickSlot[] {
    const minutes = this.minutes();
    const pro = this.professionalId();
    const now = this.store.now();
    const rejected = this.rejected();
    const ranges = GUIDE[new Date(dayStart).getDay()];
    const published = this.store.schedule().length > 0;
    return CANDIDATES.flatMap((value) => {
      const start = at(dayStart, value);
      const from = toMin(value);
      const closed = published ? !!this.store.unavailableReason(start, minutes, pro) : !ranges.some(([a, b]) => from >= toMin(a) && from + minutes <= toMin(b));
      if (closed) return [];
      const busy = start < now || rejected.has(`${pro}|${start}`) || this.store.hasConflict(pro, start, minutes, this.reschedule?.id);
      return [{ value, label: timeLabel(start), busy }];
    });
  }

  protected openPicker(): void {
    this.error.set('');
    if (!this.reschedule) {
      if (!this.service()) return this.fail('Primero elige el servicio.');
      if (!this.professionalId()) return this.fail('Primero elige quién atiende.');
    }
    const data: PickSlotData = { day: this.day(), time: this.time(), slots: (d) => this.slotsOf(d) };
    this.dialog
      .open<PickSlotDialog, PickSlotData, PickSlotResult>(PickSlotDialog, { data, autoFocus: false })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        this.day.set(r.day);
        this.time.set(r.time);
      });
  }

  protected save(): void {
    this.error.set('');
    if (!this.reschedule) {
      if (!this.patientId()) return this.fail('Elige el paciente de la lista.');
      if (!this.service()) return this.fail('Elige el servicio.');
      if (!this.professionalId()) return this.fail('Elige quién atiende.');
    }
    if (!this.time()) return this.fail('Elige la fecha y la hora.');
    const service = this.service();
    const minutes = this.minutes();
    const start = at(this.day(), this.time());
    const pro = this.professionalId();
    if (this.store.hasConflict(pro, start, minutes, this.reschedule?.id)) return this.fail('Ese horario ya no está libre. Elige otro.');

    this.saving.set(true);
    const request = this.reschedule
      ? this.store.reschedule(this.reschedule.id, start)
      : this.store.addAppointment({
          patientId: this.patientId(),
          service: service!.name,
          serviceId: service!.id,
          professionalId: pro,
          start,
          minutes,
          note: this.note().trim() || undefined,
        });
    request.subscribe({
      next: () => this.ref.close(true),
      error: (e: unknown) => {
        this.saving.set(false);
        const code = (e as ApiError)?.code;
        if (code === 'SLOT_UNAVAILABLE' || code === 'SLOT_TAKEN') {
          // El servidor manda: esa hora no sirve para este profesional. Se marca y se pide otra.
          this.rejected.update((s) => new Set(s).add(`${pro}|${start}`));
          this.time.set('');
          this.error.set(
            `El servidor rechazó ${longDate(start)} a las ${timeLabel(start)} para este profesional: está fuera de su horario o ya ocupada. ` +
              'Elige otra fecha u hora, u otro profesional. Si todas fallan, el horario del profesional en Calendar no coincide con el de la clínica: avisa a backend.',
          );
          return;
        }
        this.error.set(errorMessage(e));
      },
      // `addAppointment` emite una vez y completa; si no hubiera clínica (EMPTY) no se queda cargando.
      complete: () => this.saving.set(false),
    });
  }

  private fail(msg: string): void {
    this.error.set(msg);
  }
}
