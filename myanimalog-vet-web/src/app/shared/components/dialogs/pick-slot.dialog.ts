import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { addDays, cap, longDate, monthName, startOfDay } from '@services/clinic/date.utils';

export interface PickSlot {
  value: string;
  label: string;
  busy: boolean;
}

export interface PickSlotData {
  /** Día elegido (ms, inicio del día) y hora elegida ("HH:MM"), si ya había. */
  day: number;
  time: string;
  /** Horas de un día (ya filtradas por horario, ocupación y profesional). */
  slots: (dayStart: number) => PickSlot[];
}

export interface PickSlotResult {
  day: number;
  time: string;
}

const WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAYS_SHOWN = 5;

/** Sub-ventana para elegir fecha y hora: tira de días, calendario del mes y lista de horas por jornada. */
@Component({
  selector: 'vet-pick-slot-dialog',
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>Elige fecha y hora</h2>
    <mat-dialog-content class="content">
      <div class="monthbar">
        <button type="button" class="month" [attr.aria-expanded]="calendarOpen()" (click)="calendarOpen.set(!calendarOpen())">
          {{ monthLabel() }} <span aria-hidden="true">{{ calendarOpen() ? '▴' : '▾' }}</span>
        </button>
        @if (calendarOpen()) {
          <span class="nav-pair">
            <button type="button" class="nav" [disabled]="!canPrevMonth()" (click)="shiftMonth(-1)" aria-label="Mes anterior">‹</button>
            <button type="button" class="nav" (click)="shiftMonth(1)" aria-label="Mes siguiente">›</button>
          </span>
        }
      </div>

      @if (calendarOpen()) {
        <div class="cal" role="grid" aria-label="Calendario">
          @for (h of headers; track $index) { <span class="hd">{{ h }}</span> }
          @for (c of cells(); track c.key) {
            @if (c.start === null) {
              <span></span>
            } @else {
              <button type="button" class="cell" [class.on]="c.start === day()" [class.off]="!c.open" [class.today]="c.today" [disabled]="c.past"
                      [attr.aria-pressed]="c.start === day()" (click)="pickFromCalendar(c.start)">{{ c.num }}</button>
            }
          }
        </div>
      } @else {
        <div class="strip" role="group" aria-label="Días">
          <button type="button" class="nav" [disabled]="!canGoBack()" (click)="shift(-1)" aria-label="Días anteriores">‹</button>
          @for (d of strip(); track d.start) {
            <button type="button" class="day" [class.on]="d.start === day()" [class.off]="!d.open" [attr.aria-pressed]="d.start === day()" (click)="pickDay(d.start)">
              <small>{{ d.name }}</small><strong>{{ d.num }}</strong>
            </button>
          }
          <button type="button" class="nav" (click)="shift(1)" aria-label="Días siguientes">›</button>
        </div>
      }

      <h3 class="sub">{{ title() }}</h3>
      @if (!groups().length) {
        <p class="note">La clínica no atiende este día. Prueba con otro.</p>
      } @else {
        <div class="times" role="listbox" aria-label="Horas">
          @for (g of groups(); track g.name) {
            <div class="group">{{ g.name }}</div>
            @for (s of g.slots; track s.value) {
              <button type="button" role="option" class="time" [class.on]="s.value === time()" [disabled]="s.busy" [attr.aria-selected]="s.value === time()" (click)="time.set(s.value)">
                <span>{{ s.label }}</span>
                @if (s.value === time()) { <span aria-hidden="true">✓</span> } @else if (s.busy) { <small>no disponible</small> }
              </button>
            }
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="vet-btn vet-btn--secondary" mat-dialog-close>Cancelar</button>
      <button type="button" class="vet-btn vet-btn--primary" [disabled]="!time()" (click)="accept()">Listo</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: grid; gap: 12px; width: min(440px, 86vw); box-sizing: border-box; padding: 8px 24px 12px !important; overflow-x: hidden; }
    mat-dialog-actions { padding: 8px 24px 20px; gap: 8px; }
    .monthbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .month { border: none; background: var(--vet-soft); color: var(--vet-primary); font: inherit; font-weight: 700; padding: 6px 12px; border-radius: 10px; cursor: pointer; }
    .nav-pair { display: flex; gap: 4px; }
    .strip { display: flex; align-items: center; gap: 4px; min-width: 0; }
    .nav { flex: 0 0 28px; height: 40px; border: none; background: transparent; color: var(--vet-primary); font-size: 26px; cursor: pointer; padding: 0; }
    .strip .nav { height: 56px; flex-basis: 26px; }
    .nav:disabled { opacity: .3; cursor: default; }
    .day { flex: 1 1 0; min-width: 0; height: 62px; border-radius: 14px; border: 1.5px solid #e4e2f4; background: #fff; color: var(--vet-text); font: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; padding: 0; }
    .day small { font-size: 12px; text-transform: capitalize; color: #6b6b80; }
    .day strong { font-size: 19px; }
    .day.on { background: var(--vet-primary); border-color: var(--vet-primary); color: #fff; }
    .day.on small { color: #dcd9ff; }
    .day.off:not(.on) { background: #f5f5f8; color: #a0a0b0; }
    .day.off:not(.on) small { color: #a0a0b0; }

    .cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .hd { text-align: center; font-size: 12px; font-weight: 700; color: #6b6b80; padding: 2px 0; }
    .cell { height: 38px; border-radius: 50%; border: 1.5px solid transparent; background: transparent; color: var(--vet-text); font: inherit; cursor: pointer; padding: 0; }
    .cell:hover:not(:disabled):not(.on) { background: var(--vet-soft); }
    .cell.today { border-color: var(--vet-primary); }
    .cell.on { background: var(--vet-primary); color: #fff; }
    .cell.off:not(.on) { color: #a0a0b0; }
    .cell:disabled { color: #d0d0da; cursor: default; }

    .sub { margin: 4px 0 0; font-size: 15px; font-weight: 700; }
    .times { display: grid; border: 1.5px solid #e4e2f4; border-radius: 14px; max-height: 232px; overflow-y: auto; background: #fff; }
    .group { position: sticky; top: 0; background: #f7f6ff; color: #6b6b80; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 6px 14px; z-index: 1; }
    .time { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 42px; padding: 0 14px; border: none; border-top: 1px solid #f0effa; background: #fff; color: var(--vet-text); font: inherit; cursor: pointer; text-align: left; }
    .time:hover:not(:disabled):not(.on) { background: var(--vet-soft); }
    .time.on { background: var(--vet-primary); color: #fff; font-weight: 700; }
    .time:disabled { color: #b0b0c0; cursor: default; }
    .time small { font-size: 12px; }
    .note { color: #6b6b80; font-size: 13px; margin: 0; line-height: 1.4; }
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class PickSlotDialog {
  private readonly ref = inject<MatDialogRef<PickSlotDialog, PickSlotResult>>(MatDialogRef);
  private readonly data = inject<PickSlotData>(MAT_DIALOG_DATA);

  protected readonly headers = HEADERS;
  protected readonly day = signal(this.data.day);
  protected readonly time = signal(this.data.time);
  protected readonly calendarOpen = signal(false);
  private readonly stripStart = signal(this.data.day);
  private readonly monthStart = signal(this.firstOfMonth(this.data.day));

  protected readonly canGoBack = computed(() => this.stripStart() > startOfDay(Date.now()));
  protected readonly canPrevMonth = computed(() => this.monthStart() > this.firstOfMonth(Date.now()));
  protected readonly monthLabel = computed(() => {
    const d = new Date(this.calendarOpen() ? this.monthStart() : this.day());
    return `${cap(monthName(d.getMonth()))} ${d.getFullYear()}`;
  });
  protected readonly title = computed(() => `Horas libres · ${longDate(this.day())}`);

  protected readonly groups = computed(() => {
    const all = this.data.slots(this.day());
    const morning = all.filter((s) => Number(s.value.slice(0, 2)) < 12);
    const afternoon = all.filter((s) => Number(s.value.slice(0, 2)) >= 12);
    return [
      { name: 'Mañana', slots: morning },
      { name: 'Tarde', slots: afternoon },
    ].filter((g) => g.slots.length);
  });

  protected readonly strip = computed(() =>
    Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const start = startOfDay(addDays(this.stripStart(), i));
      const d = new Date(start);
      return { start, name: WEEKDAY[d.getDay()], num: d.getDate(), open: this.hasFree(start) };
    }),
  );

  /** Celdas del mes (lunes primero): vacías antes del día 1, y cada día con si hay horas libres. */
  protected readonly cells = computed(() => {
    const first = new Date(this.monthStart());
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const today = startOfDay(Date.now());
    return [
      ...Array.from({ length: lead }, (_, i) => ({ key: `e${i}`, start: null as number | null, num: 0, past: true, open: false, today: false })),
      ...Array.from({ length: total }, (_, i) => {
        const start = new Date(first.getFullYear(), first.getMonth(), i + 1).getTime();
        return { key: `d${i}`, start: start as number | null, num: i + 1, past: start < today, open: start >= today && this.hasFree(start), today: start === today };
      }),
    ];
  });

  private firstOfMonth(ms: number): number {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  private hasFree(start: number): boolean {
    return this.data.slots(start).some((s) => !s.busy);
  }

  protected pickDay(start: number): void {
    if (start !== this.day()) this.time.set('');
    this.day.set(start);
  }

  protected pickFromCalendar(start: number): void {
    this.stripStart.set(start);
    this.pickDay(start);
    this.calendarOpen.set(false);
  }

  protected shift(dir: 1 | -1): void {
    const next = Math.max(startOfDay(Date.now()), startOfDay(addDays(this.stripStart(), dir * DAYS_SHOWN)));
    this.stripStart.set(next);
    this.pickDay(next);
  }

  protected shiftMonth(dir: 1 | -1): void {
    const d = new Date(this.monthStart());
    this.monthStart.set(new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime());
  }

  protected accept(): void {
    if (this.time()) this.ref.close({ day: this.day(), time: this.time() });
  }
}
