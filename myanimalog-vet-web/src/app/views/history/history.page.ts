import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { ClinicalSummary, LabEntry, MedicalApi, SurgeryEntry, TreatmentEntry, VaccineEntry, Visit, WeightEntry } from '@services/api/medical.api';
import { Observable } from 'rxjs';
import { RecordData, RecordDialog, RecordKind } from './record.dialog';

export type HistoryTab = 'summary' | 'visits' | 'vaccines' | 'weight' | 'treatments' | 'surgeries' | 'labs';

const MODAL: MatDialogConfig = { panelClass: 'vet-dialog', backdropClass: 'vet-backdrop', autoFocus: 'first-tabbable', maxWidth: '96vw' };

/** Una parte de la historia: cada una carga por su cuenta y puede fallar sin tumbar las demás. */
interface Part<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

const empty = <T>(data: T): Part<T> => ({ data, loading: true, error: null });

const SHARED_HINT = 'Esta mascota no está compartida con tu clínica, o el dueño quitó el acceso.';

/**
 * Historia clínica de un paciente (`/pacientes/:petId/historia`), Figma 1997:225 a 2002:719.
 * Lee de Medical con el token de clínica: resumen, consultas, vacunas, peso, tratamientos, cirugías y laboratorio.
 * Escribir (visita, vacuna, peso) depende del rol; el backend vuelve a validar y responde 403 si no corresponde.
 */
@Component({
  selector: 'vet-history-page',
  standalone: false,
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage implements OnInit {
  private readonly api = inject(MedicalApi);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly petId = this.route.snapshot.paramMap.get('petId') ?? '';
  protected readonly tab = signal<HistoryTab>('summary');

  protected readonly summary = signal<Part<ClinicalSummary | null>>(empty(null));
  protected readonly visits = signal<Part<Visit[]>>(empty([]));
  protected readonly vaccines = signal<Part<VaccineEntry[]>>(empty([]));
  protected readonly weights = signal<Part<WeightEntry[]>>(empty([]));
  protected readonly surgeries = signal<Part<SurgeryEntry[]>>(empty([]));
  protected readonly treatments = signal<Part<TreatmentEntry[]>>({ data: [], loading: false, error: null });
  protected readonly labs = signal<Part<LabEntry[]>>({ data: [], loading: false, error: null });
  private extrasLoaded = false;

  private readonly role = computed(() => this.session.clinic()?.role ?? null);
  /** Recepción solo ve el resumen básico (`CLINICAL_READ_BASIC`). */
  protected readonly basicOnly = computed(() => this.role() === 'RECEPTIONIST');
  /** Escribe consultas: dueño, administrador o veterinario (con tarjeta verificada; el backend lo valida). */
  protected readonly canWriteClinical = computed(() => ['OWNER', 'ADMIN', 'VETERINARIAN'].includes(this.role() ?? ''));
  /** Vacunas y peso: además, auxiliares. */
  protected readonly canNursing = computed(() => this.canWriteClinical() || this.role() === 'ASSISTANT');

  protected readonly tabs = computed<{ value: HistoryTab; label: string; count: number | null }[]>(() => {
    const all: { value: HistoryTab; label: string; count: number | null }[] = [
      { value: 'summary', label: 'Resumen', count: null },
      { value: 'visits', label: 'Consultas', count: this.visits().data.length },
      { value: 'vaccines', label: 'Vacunas', count: this.vaccines().data.length },
      { value: 'treatments', label: 'Tratamientos', count: this.treatments().data.length },
      { value: 'surgeries', label: 'Cirugías', count: this.surgeries().data.length },
      { value: 'labs', label: 'Laboratorio', count: this.labs().data.length },
      { value: 'weight', label: 'Peso', count: this.weights().data.length },
    ];
    return this.basicOnly() ? all.slice(0, 1) : all;
  });

  /** Último peso: el del resumen o el más reciente del historial. */
  protected readonly lastWeight = computed(() => {
    const w = [...this.weights().data].sort((a, b) => b.date.localeCompare(a.date))[0];
    return w ? `${w.weight} ${w.unit}` : this.summary().data?.lastWeight != null ? `${this.summary().data!.lastWeight} kg` : null;
  });

  /** Peso más reciente primero, con el cambio frente al anterior. */
  protected readonly weightRows = computed(() => {
    const sorted = [...this.weights().data].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.map((w, i) => {
      const prev = sorted[i + 1];
      const diff = prev && prev.unit === w.unit ? Math.round((w.weight - prev.weight) * 100) / 100 : null;
      return { ...w, diff };
    });
  });

  protected readonly sortedVisits = computed(() => [...this.visits().data].sort((a, b) => b.date.localeCompare(a.date)));
  protected readonly sortedVaccines = computed(() => [...this.vaccines().data].sort((a, b) => b.applicationDate.localeCompare(a.applicationDate)));
  protected readonly sortedSurgeries = computed(() => [...this.surgeries().data].sort((a, b) => b.surgeryDate.localeCompare(a.surgeryDate)));

  /** Línea de tiempo del resumen: lo más reciente de todo, mezclado. */
  protected readonly timeline = computed(() => {
    const items: { date: string; kind: string; title: string; detail: string }[] = [
      ...this.visits().data.map((v) => ({ date: v.date, kind: 'Consulta', title: v.reason || 'Consulta', detail: [v.veterinarian, v.veterinaryName].filter(Boolean).join(' · ') })),
      ...this.vaccines().data.map((v) => ({ date: v.applicationDate, kind: 'Vacuna', title: v.name, detail: v.nextDoseDate ? `Próxima dosis: ${this.day(v.nextDoseDate)}` : '' })),
      ...this.surgeries().data.map((s) => ({ date: s.surgeryDate, kind: 'Cirugía', title: s.title, detail: s.status })),
      ...this.weights().data.map((w) => ({ date: w.date, kind: 'Peso', title: `${w.weight} ${w.unit}`, detail: w.source === 'OWNER' ? 'Registrado por el dueño' : '' })),
    ];
    return items.filter((i) => i.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  });

  ngOnInit(): void {
    if (!this.petId) return;
    this.load(this.summary, this.api.clinicalSummary(this.petId));
    if (this.basicOnly()) return;
    this.load(this.visits, this.api.visitsByPet(this.petId));
    this.load(this.vaccines, this.api.vaccines(this.petId));
    this.load(this.weights, this.api.weights(this.petId));
    this.load(this.surgeries, this.api.surgeries(this.petId));
  }

  protected select(tab: HistoryTab): void {
    this.tab.set(tab);
    if ((tab === 'treatments' || tab === 'labs') && !this.extrasLoaded && !this.visits().loading) this.loadExtras();
  }

  protected reload(): void {
    this.extrasLoaded = false;
    this.summary.set(empty(null));
    this.visits.set(empty([]));
    this.vaccines.set(empty([]));
    this.weights.set(empty([]));
    this.surgeries.set(empty([]));
    this.treatments.set({ data: [], loading: false, error: null });
    this.labs.set({ data: [], loading: false, error: null });
    this.ngOnInit();
  }

  protected add(kind: RecordKind, targetId?: string): void {
    const data: RecordData = { kind, petId: this.petId, visits: this.visits().data, targetId };
    this.dialog
      .open<RecordDialog, RecordData, boolean>(RecordDialog, { ...MODAL, data })
      .afterClosed()
      .subscribe((saved) => saved && this.reload());
  }

  protected day(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Tratamiento, cirugía y examen cuelgan de una consulta: sin consultas no se pueden crear. */
  protected readonly hasVisits = computed(() => this.visits().data.length > 0);

  protected treatmentTone(status: string): 'ok' | 'warn' | 'bad' | 'mute' {
    const s = status.toUpperCase();
    return s === 'ACTIVO' || s === 'ACTIVE' ? 'ok' : s === 'SUSPENDIDO' || s === 'REACCION' ? 'warn' : 'mute';
  }

  protected signed(n: number): string {
    return `${n > 0 ? '+' : ''}${String(n).replace('.', ',')}`;
  }

  /** Vacuna vigente / por vencer / vencida según la próxima dosis. */
  protected vaccineState(v: VaccineEntry): { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' } {
    if (!v.nextDoseDate) return { label: 'Aplicada', tone: 'mute' };
    const days = Math.ceil((new Date(`${v.nextDoseDate.slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86_400_000);
    return days < 0 ? { label: 'Vencida', tone: 'bad' } : days <= 30 ? { label: 'Por vencer', tone: 'warn' } : { label: 'Vigente', tone: 'ok' };
  }

  private loadExtras(): void {
    this.extrasLoaded = true;
    const visits = this.visits().data;
    this.load(this.treatments, this.api.treatmentsOf(visits));
    this.load(this.labs, this.api.labsOf(visits));
  }

  private load<T>(target: { set(v: Part<T>): void; update(f: (p: Part<T>) => Part<T>): void }, source: Observable<T>): void {
    target.update((p) => ({ ...p, loading: true, error: null }));
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        target.set({ data, loading: false, error: null });
        // Tratamientos y laboratorio salen de las visitas: si ya se abrió esa pestaña, se piden en cuanto llegan.
        if (!this.extrasLoaded && (this.tab() === 'treatments' || this.tab() === 'labs') && Array.isArray(data) && this.visits().data === data) this.loadExtras();
      },
      error: (e: unknown) => {
        const forbidden = (e as { status?: number })?.status === 403;
        target.update((p) => ({ ...p, loading: false, error: forbidden ? SHARED_HINT : errorMessage(e, 'No pudimos cargar esta parte de la historia.') }));
      },
    });
  }
}
