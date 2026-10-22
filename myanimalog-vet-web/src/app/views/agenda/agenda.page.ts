import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AGENDA_END_HOUR, AGENDA_START_HOUR, AgendaService, HOUR_PX, LUNCH } from '@services/agenda/agenda.service';
import { Appointment, AppointmentStatus, STATUS_COLOR } from '@services/clinic/clinic.models';
import { ClinicStore } from '@services/clinic/clinic.store';
import { cap, longDate, monthName, sameDay, startOfDay, timeLabel } from '@services/clinic/date.utils';
import { PanelActionsService } from '@services/panel/panel-actions.service';

interface MonthCell {
  day: number;
  label: number;
  inMonth: boolean;
  dot: boolean;
  today: boolean;
  selected: boolean;
  weekend: boolean;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Agenda (Figma 1941:174): día por profesional o semana, mini calendario, solicitudes y detalle de la cita. */
@Component({
  selector: 'vet-agenda-page',
  standalone: false,
  templateUrl: './agenda.page.html',
  styleUrl: './agenda.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage {
  protected readonly agenda = inject(AgendaService);
  protected readonly store = inject(ClinicStore);
  private readonly actions = inject(PanelActionsService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly weekdayNames = WEEKDAY_NAMES;
  protected readonly hourPx = HOUR_PX;
  protected readonly lunch = LUNCH;
  protected readonly hours = Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR + 1 }, (_, i) => AGENDA_START_HOUR + i);
  protected readonly gridHeight = (AGENDA_END_HOUR - AGENDA_START_HOUR) * HOUR_PX;
  protected readonly legend: { status: AppointmentStatus; label: string }[] = [
    { status: 'CONFIRMED', label: 'Confirmada' },
    { status: 'REQUESTED', label: 'Por confirmar' },
    { status: 'CHECKED_IN', label: 'En la clínica' },
    { status: 'COMPLETED', label: 'Atendida' },
    { status: 'NO_SHOW', label: 'No asistió' },
  ];
  protected readonly colors = STATUS_COLOR;

  protected readonly title = computed(() => longDate(this.agenda.day()));
  protected readonly monthTitle = computed(() => {
    const d = new Date(this.agenda.month());
    return `${cap(monthName(d.getMonth()))} ${d.getFullYear()}`;
  });
  protected readonly weekTitle = computed(() => {
    const days = this.agenda.weekDays();
    const a = new Date(days[0]);
    const b = new Date(days[6]);
    return `${a.getDate()} ${monthName(a.getMonth()).slice(0, 3)} – ${b.getDate()} ${monthName(b.getMonth()).slice(0, 3)}`;
  });

  protected readonly cells = computed<MonthCell[]>(() => {
    const first = new Date(this.agenda.month());
    first.setDate(1);
    const offset = (first.getDay() + 6) % 7;
    const dots = this.agenda.daysWithAppointments();
    const out: MonthCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setDate(1 - offset + i);
      const ms = startOfDay(d.getTime());
      if (i >= 35 && d.getMonth() !== first.getMonth()) break;
      out.push({
        day: ms,
        label: d.getDate(),
        inMonth: d.getMonth() === first.getMonth(),
        dot: dots.has(ms),
        today: sameDay(ms, this.store.now()),
        selected: sameDay(ms, this.agenda.day()),
        weekend: i % 7 >= 5,
      });
    }
    return out;
  });

  protected readonly nowLine = computed(() => {
    if (!this.agenda.isToday()) return null;
    const d = new Date(this.store.now());
    const minutes = d.getHours() * 60 + d.getMinutes() - AGENDA_START_HOUR * 60;
    if (minutes < 0 || minutes > (AGENDA_END_HOUR - AGENDA_START_HOUR) * 60) return null;
    return { top: (minutes / 60) * HOUR_PX, label: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` };
  });

  protected hourLabel(h: number): { time: string; suffix: string } {
    return { time: `${h % 12 === 0 ? 12 : h % 12}:00`, suffix: h === AGENDA_START_HOUR || h === 12 ? (h < 12 ? 'a. m.' : 'p. m.') : '' };
  }

  protected top(a: Appointment): number {
    const d = new Date(a.start);
    return ((d.getHours() * 60 + d.getMinutes() - AGENDA_START_HOUR * 60) / 60) * HOUR_PX;
  }

  protected height(a: Appointment): number {
    return Math.max(32, (a.minutes / 60) * HOUR_PX - 4);
  }

  protected inRange(a: Appointment): boolean {
    const t = this.top(a);
    return t >= 0 && t < this.gridHeight;
  }

  protected isTall(a: Appointment): boolean {
    return a.minutes >= 60;
  }

  protected time(ms: number): string {
    return timeLabel(ms);
  }

  protected range(a: Appointment): string {
    const f = (ms: number) => timeLabel(ms).replace(' a. m.', '').replace(' p. m.', '');
    return `${f(a.start)} – ${f(a.start + a.minutes * 60_000)}`;
  }

  protected dayLabel(ms: number): { name: string; num: number } {
    const d = new Date(ms);
    return { name: WEEKDAY_NAMES[(d.getDay() + 6) % 7], num: d.getDate() };
  }

  protected isSelected(ms: number): boolean {
    return sameDay(ms, this.agenda.day());
  }

  protected dateLabel(ms: number): string {
    return longDate(ms);
  }

  protected professional(id: string) {
    return this.store.professional(id);
  }

  protected patient(a: Appointment) {
    return this.store.patient(a.patientId);
  }

  protected pick(day: number): void {
    this.agenda.goTo(day);
  }

  protected open(a: Appointment): void {
    this.agenda.selectedId.set(a.id);
  }

  protected close(): void {
    this.agenda.selectedId.set(null);
  }

  /** Clic en un hueco libre: abre "Nueva cita" con ese día. */
  protected newAppointment(day = this.agenda.day()): void {
    this.actions.newAppointment({ day });
  }

  protected change(a: Appointment, status: AppointmentStatus, message: string): void {
    this.agenda.setStatus(a.id, status);
    this.actions.toast(message);
    if (status === 'CANCELLED') this.close();
  }

  protected accept(a: Appointment): void {
    this.change(a, 'CONFIRMED', `Cita de ${a.patientName} aceptada`);
  }

  protected reject(a: Appointment): void {
    this.change(a, 'CANCELLED', `Solicitud de ${a.patientName} rechazada`);
  }

  protected call(phone: string): void {
    window.open(`tel:${phone.replace(/\s/g, '')}`, '_self');
  }
}
