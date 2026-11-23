import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { AllergyEntry, AllergyList, ClinicalSummary, DewormingStatus, DewormingType, LabEntry, MedicalApi, SurgeryEntry, TreatmentEntry, VaccineEntry, Visit, WeightEntry } from '@services/api/medical.api';
import { ClinicStore } from '@services/clinic/clinic.store';
import { PanelActionsService } from '@services/panel/panel-actions.service';
import { Observable } from 'rxjs';
import { RecordData, RecordDialog, RecordKind } from './record.dialog';

export type HistoryTab = 'summary' | 'visits' | 'vaccines' | 'deworming' | 'allergies' | 'weight' | 'treatments' | 'surgeries' | 'labs' | 'documents';
export type Origin = 'clinic' | 'other' | 'owner';
export type Tone = 'ok' | 'warn' | 'bad' | 'mute';

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
 * Escribir (visita, vacuna, peso…) depende del rol; el backend vuelve a validar y responde 403 si no corresponde.
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
  private readonly store = inject(ClinicStore);
  private readonly actions = inject(PanelActionsService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly petId = this.route.snapshot.paramMap.get('petId') ?? '';
  protected readonly tab = signal<HistoryTab>('summary');

  protected readonly summary = signal<Part<ClinicalSummary | null>>(empty(null));
  protected readonly visits = signal<Part<Visit[]>>(empty([]));
  protected readonly vaccines = signal<Part<VaccineEntry[]>>(empty([]));
  protected readonly weights = signal<Part<WeightEntry[]>>(empty([]));
  protected readonly allergies = signal<Part<AllergyList>>(empty({ status: 'UNKNOWN', items: [] }));
  protected readonly dewormings = signal<Part<DewormingStatus | null>>(empty(null));
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

  /**
   * Historial de peso: el registro de `/weight` más el peso que se anotó en cada consulta (`visit.weight`).
   * Muchas mascotas tienen peso solo en el perfil o en consultas y nunca se registró en `/weight`, que es una tabla aparte.
   */
  protected readonly allWeights = computed<WeightEntry[]>(() => {
    const log = this.weights().data;
    const seen = new Set(log.map((w) => `${w.date.slice(0, 10)}|${w.weight}`));
    const fromVisits: WeightEntry[] = this.visits()
      .data.filter((v) => v.weight !== null && v.date)
      .filter((v) => !seen.has(`${v.date.slice(0, 10)}|${v.weight}`))
      .map((v) => ({ id: `visit-${v.id}`, petId: v.petId, weight: v.weight as number, unit: 'kg', date: v.date, note: v.reason ? `Consulta: ${v.reason}` : 'Consulta', source: 'CLINIC' }));
    return [...log, ...fromVisits];
  });

  protected readonly tabs = computed<{ value: HistoryTab; label: string; count: number | null }[]>(() => {
    const all: { value: HistoryTab; label: string; count: number | null }[] = [
      { value: 'summary', label: 'Resumen', count: null },
      { value: 'visits', label: 'Consultas', count: this.visits().data.length },
      { value: 'vaccines', label: 'Vacunas', count: this.vaccines().data.length },
      { value: 'deworming', label: 'Desparasitación', count: null },
      { value: 'allergies', label: 'Alergias', count: this.activeAllergies().length },
      { value: 'treatments', label: 'Tratamientos', count: this.treatments().data.length },
      { value: 'surgeries', label: 'Cirugías', count: this.surgeries().data.length },
      { value: 'labs', label: 'Laboratorio', count: this.labs().data.length },
      { value: 'weight', label: 'Peso', count: this.allWeights().length },
      { value: 'documents', label: 'Documentos', count: null },
    ];
    return this.basicOnly() ? all.slice(0, 1) : all;
  });

  /** Quién escribe en cada pestaña (nota a la derecha de las pestañas, como en el Figma). */
  protected readonly tabNote = computed(() => {
    const notes: Record<HistoryTab, string> = {
      summary: 'Recepción: solo Resumen',
      visits: 'Escriben: veterinarios',
      vaccines: 'Aplican: vets y auxiliares',
      deworming: 'Registran: vets y auxiliares',
      allergies: 'Confirman: veterinarios',
      treatments: 'Recetan: veterinarios',
      surgeries: 'Registran: veterinarios',
      labs: 'Registran: veterinarios',
      weight: 'Registran: vets, auxiliares y el dueño',
      documents: 'Suben: equipo clínico',
    };
    return notes[this.tab()];
  });

  /** Datos del paciente para la cabecera: salen de la lista de pacientes de la clínica (no hay otro endpoint con token de clínica). */
  protected readonly patient = computed(() => this.store.patient(this.petId));
  protected readonly petLine = computed(() => {
    const p = this.patient();
    if (!p) return '';
    return [p.species, p.breed, p.sex, p.age, this.lastWeight()].filter(Boolean).join(' · ');
  });
  private readonly ownClinicId = computed(() => this.session.clinic()?.veterinaryId ?? null);
  protected readonly ownClinicName = computed(() => this.session.clinic()?.veterinaryName ?? 'Esta clínica');

  /** Último peso: el del resumen o el más reciente del historial. */
  protected readonly lastWeight = computed(() => {
    const w = [...this.allWeights()].sort((a, b) => b.date.localeCompare(a.date))[0];
    return w ? `${w.weight} ${w.unit}` : this.summary().data?.lastWeight != null ? `${this.summary().data!.lastWeight} kg` : this.patient()?.weight != null ? `${this.patient()!.weight} kg` : null;
  });

  /** Peso más reciente primero, con el cambio frente al anterior. */
  protected readonly weightRows = computed(() => {
    const sorted = [...this.allWeights()].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.map((w, i) => {
      const prev = sorted[i + 1];
      const diff = prev && prev.unit === w.unit ? Math.round((w.weight - prev.weight) * 100) / 100 : null;
      return { ...w, diff };
    });
  });

  protected readonly sortedVisits = computed(() => [...this.visits().data].sort((a, b) => b.date.localeCompare(a.date)));
  protected readonly sortedVaccines = computed(() => [...this.vaccines().data].sort((a, b) => b.applicationDate.localeCompare(a.applicationDate)));
  protected readonly sortedSurgeries = computed(() => [...this.surgeries().data].sort((a, b) => b.surgeryDate.localeCompare(a.surgeryDate)));

  // ───── Salud: esterilización, alergias y desparasitación
  protected readonly neutered = computed(() => this.summary().data?.neutered ?? null);
  protected readonly neuteredChip = computed<{ label: string; tone: Tone } | null>(() => {
    const n = this.neutered();
    if (!n) return null;
    if (n.status === 'YES') return { label: n.at ? `Esterilizado · ${this.short(n.at)}` : 'Esterilizado', tone: n.confirmed ? 'ok' : 'mute' };
    if (n.status === 'NO') return { label: 'No esterilizado', tone: 'mute' };
    return { label: 'Esterilización sin confirmar', tone: 'mute' };
  });
  protected readonly activeAllergies = computed(() => this.allergies().data.items.filter((a) => a.state === 'SUSPECTED' || a.state === 'CONFIRMED'));
  protected readonly pastAllergies = computed(() => this.allergies().data.items.filter((a) => a.state === 'RESOLVED'));
  /** "Alergias sin preguntar": no se afirma que no tenga cuando nadie lo ha dicho. */
  protected readonly allergyNote = computed(() => {
    const s = this.allergies().data.status;
    return s === 'NONE_KNOWN' ? 'Sin alergias conocidas (según el dueño o una clínica).' : s === 'UNKNOWN' && !this.activeAllergies().length ? 'Alergias sin preguntar: nadie ha indicado si tiene o no.' : '';
  });
  /** Último de cada tipo con su estado (al día, por vencer, vencida), igual que las vacunas. */
  protected readonly dewormingRows = computed(() => {
    const d = this.dewormings().data;
    if (!d) return [];
    return (['INTERNAL', 'EXTERNAL'] as DewormingType[]).map((k) => {
      const last = d[k];
      const days = last.nextDoseDate ? Math.ceil((new Date(`${last.nextDoseDate}T00:00:00`).getTime() - Date.now()) / 86_400_000) : null;
      const state: { label: string; tone: Tone } = !last.registered ? { label: 'Sin registro', tone: 'mute' } : days === null ? { label: 'Registrada', tone: 'ok' } : days < 0 ? { label: 'Vencida', tone: 'bad' } : days <= 7 ? { label: 'Por vencer', tone: 'warn' } : { label: 'Al día', tone: 'ok' };
      return { ...last, name: k === 'INTERNAL' ? 'Interna' : 'Externa', hint: k === 'INTERNAL' ? 'Lombrices' : 'Pulgas y garrapatas', state };
    });
  });
  protected readonly dewormingOverdue = computed(() => this.dewormingRows().filter((r) => r.state.tone === 'bad').length);

  protected severityChip(s: string): { label: string; tone: Tone } {
    return s === 'SEVERE' ? { label: 'Grave', tone: 'bad' } : s === 'MODERATE' ? { label: 'Moderada', tone: 'warn' } : { label: 'Leve', tone: 'mute' };
  }
  protected categoryLabel(c: string): string {
    return c === 'DRUG' ? 'Medicamento' : c === 'FOOD' ? 'Alimento' : c === 'ENVIRONMENT' ? 'Ambiente' : 'Otro';
  }
  protected allergyOrigin(a: AllergyEntry): string {
    return a.state === 'CONFIRMED' ? (a.veterinaryName ? `Confirmada por ${a.veterinaryName}` : 'Confirmada') : a.source === 'CLINIC' ? 'Registrada por una clínica' : 'Declarada por el dueño';
  }

  // ───── Resumen
  private originOfVisit(v: Visit): Origin | null {
    if (!v.veterinaryId && !v.veterinaryName) return null;
    return v.veterinaryId && v.veterinaryId === this.ownClinicId() ? 'clinic' : 'other';
  }

  protected readonly timelineScope = signal<'all' | 'clinic' | 'other'>('all');
  protected readonly timelineScopes = [
    { value: 'all' as const, label: 'Todo' },
    { value: 'clinic' as const, label: 'Esta clínica' },
    { value: 'other' as const, label: 'Otras clínicas' },
  ];

  /** Todo lo registrado, mezclado y con su origen cuando el backend lo dice. */
  private readonly allTimeline = computed(() => {
    const items: { date: string; kind: string; title: string; detail: string; origin: Origin | null; originName: string }[] = [
      ...this.visits().data.map((v) => ({ date: v.date, kind: 'Consulta', title: v.reason || 'Consulta', detail: v.diagnosis || v.veterinarian, origin: this.originOfVisit(v), originName: v.veterinaryName })),
      ...this.vaccines().data.map((v) => ({ date: v.applicationDate, kind: 'Vacuna', title: v.name, detail: [v.lotNumber && `Lote ${v.lotNumber}`, v.veterinarian].filter(Boolean).join(' · '), origin: null, originName: '' })),
      ...this.surgeries().data.map((s) => ({ date: s.surgeryDate, kind: 'Cirugía', title: s.title, detail: [s.outcome || s.status, s.durationMinutes ? `${s.durationMinutes} min` : '', s.veterinarian].filter(Boolean).join(' · '), origin: null, originName: '' })),
      ...this.allWeights().map((w) => ({ date: w.date, kind: 'Peso', title: `${w.weight} ${w.unit}`, detail: w.source === 'OWNER' ? 'Desde la app de MyAnimaLog' : '', origin: (w.source === 'OWNER' ? 'owner' : null) as Origin | null, originName: '' })),
    ];
    return items.filter((i) => i.date).sort((a, b) => b.date.localeCompare(a.date));
  });
  protected readonly timeline = computed(() => {
    const scope = this.timelineScope();
    const all = this.allTimeline();
    const list = scope === 'all' ? all : scope === 'clinic' ? all.filter((i) => i.origin === 'clinic') : all.filter((i) => i.origin === 'other' || i.origin === 'owner');
    return list.slice(0, 10);
  });
  protected readonly timelineTotal = computed(() => this.allTimeline().length);

  /** Quién registró cada cosa, para "De dónde viene la historia". */
  protected readonly sources = computed(() => {
    const counts = new Map<string, { label: string; origin: Origin; n: number }>();
    for (const i of this.allTimeline()) {
      if (!i.origin) continue;
      const label = i.origin === 'owner' ? 'Registrado por el dueño' : i.origin === 'clinic' ? this.ownClinicName() : i.originName || 'Otra clínica';
      const key = `${i.origin}:${label}`;
      counts.set(key, { label, origin: i.origin, n: (counts.get(key)?.n ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.n - a.n);
  });

  protected originLabel(o: Origin | null, name: string): string {
    return o === 'owner' ? 'Registrado por el dueño' : o === 'clinic' ? this.ownClinicName() : name || 'Otra clínica';
  }

  // ───── Consultas
  protected readonly visitScope = signal<'all' | 'clinic'>('all');
  protected readonly selectedVisitId = signal<string | null>(null);
  protected readonly shownVisits = computed(() => {
    const list = this.sortedVisits();
    return this.visitScope() === 'clinic' ? list.filter((v) => this.originOfVisit(v) === 'clinic') : list;
  });
  protected readonly selectedVisit = computed(() => {
    const list = this.shownVisits();
    return list.find((v) => v.id === this.selectedVisitId()) ?? list[0] ?? null;
  });
  protected visitOrigin(v: Visit): Origin | null {
    return this.originOfVisit(v);
  }
  /** Lo que cuelga de la consulta seleccionada (exámenes y cirugías). */
  protected readonly relatedToVisit = computed(() => {
    const v = this.selectedVisit();
    if (!v) return [];
    return [
      ...this.labs().data.filter((l) => l.visitId === v.id).map((l) => {
        const t = this.labTone(l);
        return { label: `${l.name} · ${this.short(l.date)}`, chip: t.label, tone: t.tone };
      }),
      ...this.surgeries().data.filter((s) => s.visitId === v.id).map((s) => ({ label: `${s.title} · ${this.short(s.surgeryDate)}`, chip: s.outcome || s.status || 'Registrada', tone: 'ok' as Tone })),
    ];
  });

  protected initials(name: string): string {
    return name
      .replace(/^(dr\.?|dra\.?)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }

  protected short(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
  }

  protected longDay(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
    if (Number.isNaN(d.getTime())) return iso;
    const base = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
    const time = iso.length > 10 ? ` · ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}` : '';
    return base.charAt(0).toUpperCase() + base.slice(1) + time;
  }

  protected vitalLabel(kind: 'temp' | 'hr' | 'rr', n: number | null): string {
    if (n === null) return '';
    const ranges = { temp: [37.5, 39.2], hr: [60, 140], rr: [10, 30] } as const;
    const [lo, hi] = ranges[kind];
    return n >= lo && n <= hi ? 'Normal' : n < lo ? 'Bajo' : 'Alto';
  }

  // ───── Vacunas
  protected readonly vaccineRows = computed(() => {
    const sorted = this.sortedVaccines();
    const latestByName = new Map<string, string>();
    for (const v of sorted) if (!latestByName.has(v.name.toLowerCase())) latestByName.set(v.name.toLowerCase(), v.id);
    return sorted.map((v) => {
      const old = latestByName.get(v.name.toLowerCase()) !== v.id;
      return { ...v, old, state: old ? { label: 'Anterior', tone: 'mute' as Tone } : this.vaccineState(v) };
    });
  });
  protected readonly vaccineCounts = computed(() => {
    const rows = this.vaccineRows().filter((r) => !r.old);
    const n = (label: string) => rows.filter((r) => r.state.label === label).length;
    return { valid: n('Vigente'), dueSoon: n('Por vencer'), overdue: n('Vencida') };
  });
  /** Una fila por vacuna (la más reciente de cada nombre), la que vence antes primero. */
  protected readonly currentVaccines = computed(() =>
    this.vaccineRows()
      .filter((r) => !r.old)
      .sort((a, b) => (a.nextDoseDate ?? '9999').localeCompare(b.nextDoseDate ?? '9999')),
  );

  /** Alertas del resumen: alergias, vacunas vencidas y tratamientos activos. Salen de las demás consultas, no solo de `clinical-summary`. */
  protected readonly alerts = computed(() => {
    const out: { title: string; detail: string }[] = [];
    const s = this.summary().data;
    for (const a of s?.allergies ?? []) out.push({ title: `Alergia a ${a}`, detail: '' });
    for (const v of this.overdueVaccines()) out.push({ title: `Vacuna vencida: ${v.name}`, detail: `Venció el ${this.day(v.nextDoseDate)}` });
    const active = this.activeTreatments().map((t) => t.description).filter(Boolean);
    for (const t of active.length ? active : (s?.activeTreatments ?? [])) out.push({ title: 'En tratamiento', detail: t });
    return out;
  });

  protected readonly upcomingVaccines = computed(() =>
    this.vaccineRows()
      .filter((r) => !r.old && r.nextDoseDate && r.state.tone !== 'bad')
      .sort((a, b) => a.nextDoseDate!.localeCompare(b.nextDoseDate!)),
  );
  protected readonly overdueVaccines = computed(() => this.vaccineRows().filter((r) => !r.old && r.state.tone === 'bad'));

  protected inDays(iso: string | null): string {
    if (!iso) return '';
    const days = Math.ceil((new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86_400_000);
    if (days < 0) {
      const ago = -days;
      return ago >= 60 ? `hace casi ${Math.round(ago / 30)} meses` : `hace ${ago} días`;
    }
    return days >= 60 ? `en ${Math.round(days / 30)} meses` : `en ${days} días`;
  }

  // ───── Tratamientos
  protected readonly activeTreatments = computed(() => this.treatments().data.filter((t) => this.isActive(t.status)));
  protected readonly finishedTreatments = computed(() => this.treatments().data.filter((t) => !this.isActive(t.status)));
  protected readonly medicationHistory = computed(() =>
    this.treatments()
      .data.flatMap((t) => t.medications.map((m) => ({ ...m, since: t.startDate, until: t.endDate })))
      .sort((a, b) => (b.since ?? '').localeCompare(a.since ?? '')),
  );
  protected readonly reactions = computed(() => this.medicationHistory().filter((m) => m.status.toUpperCase() === 'REACCION'));

  protected isActive(status: string): boolean {
    const s = (status || '').toUpperCase();
    return !s || s === 'ACTIVO' || s === 'ACTIVE';
  }

  protected progress(t: TreatmentEntry): { pct: number; label: string } | null {
    if (!t.startDate || !t.endDate) return null;
    const start = new Date(t.startDate.slice(0, 10)).getTime();
    const end = new Date(t.endDate.slice(0, 10)).getTime();
    if (!(end > start)) return null;
    const total = Math.round((end - start) / 86_400_000);
    const done = Math.min(total, Math.max(0, Math.round((Date.now() - start) / 86_400_000)));
    return { pct: Math.round((done / total) * 100), label: `Día ${done} de ${total}` };
  }

  protected medsLine(t: TreatmentEntry): string {
    return t.medications.map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')).join(' · ');
  }

  protected medTone(status: string): Tone {
    const s = status.toUpperCase();
    return s === 'ACTIVO' || s === 'ACTIVE' ? 'ok' : s === 'REACCION' ? 'bad' : 'mute';
  }

  protected medLabel(status: string): string {
    const s = status.toUpperCase();
    return s === 'ACTIVO' || s === 'ACTIVE' ? 'Activo' : s === 'REACCION' ? 'Reacción' : s === 'TERMINADO' ? 'Terminado' : status;
  }

  // ───── Cirugías
  protected readonly selectedSurgeryId = signal<string | null>(null);
  protected readonly selectedSurgery = computed(() => {
    const list = this.sortedSurgeries();
    return list.find((s) => s.id === this.selectedSurgeryId()) ?? list[0] ?? null;
  });

  /** Instrucciones posoperatorias: una por línea o por oración. */
  protected steps(text: string): string[] {
    return text
      .split(/\r?\n|(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/)
      .map((l) => l.replace(/^[-•\d.)\s]+/, '').trim())
      .filter(Boolean);
  }

  // ───── Laboratorio
  protected readonly selectedLabId = signal<string | null>(null);
  protected readonly sortedLabs = computed(() => [...this.labs().data].sort((a, b) => b.date.localeCompare(a.date)));
  protected readonly selectedLab = computed(() => {
    const list = this.sortedLabs();
    return list.find((l) => l.id === this.selectedLabId()) ?? list[0] ?? null;
  });

  protected labTone(l: LabEntry): { label: string; tone: Tone } {
    const out = l.results.filter((r) => r.flag && r.flag.toUpperCase() !== 'NORMAL').length;
    if (out) return { label: out === 1 ? '1 fuera de rango' : `${out} fuera de rango`, tone: 'warn' };
    if (l.status && l.status.toUpperCase() !== 'NORMAL') return { label: 'Fuera de rango', tone: 'warn' };
    if (l.status || l.isNormal) return { label: 'Normal', tone: 'ok' };
    return { label: 'Sin clasificar', tone: 'mute' };
  }

  protected flagLabel(flag: string): { label: string; tone: Tone } {
    const f = (flag || '').toUpperCase();
    return f === 'NORMAL' ? { label: 'Normal', tone: 'ok' } : f === 'ALTO' ? { label: 'Alto', tone: 'warn' } : f === 'BAJO' ? { label: 'Bajo', tone: 'warn' } : { label: flag, tone: 'mute' };
  }

  // ───── Peso
  protected readonly weightRange = signal<'6m' | '1y' | 'all'>('1y');
  protected readonly weightRanges = [
    { value: '6m' as const, label: '6 meses' },
    { value: '1y' as const, label: '1 año' },
    { value: 'all' as const, label: 'Todo' },
  ];

  protected readonly weightSummary = computed(() => {
    const sorted = [...this.allWeights()].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    if (!last) return null;
    const diff = first && first !== last && first.unit === last.unit ? Math.round((last.weight - first.weight) * 10) / 10 : null;
    const pct = diff !== null && first.weight ? Math.round((diff / first.weight) * 100) : null;
    return { last, first, diff, pct, owner: sorted.filter((w) => w.source === 'OWNER').length, total: sorted.length };
  });

  /** Gráfica de línea en SVG (sin librerías): puntos llenos = clínica, vacíos = dueño. */
  protected readonly chart = computed(() => {
    const W = 900, H = 250, L = 56, R = 30, T = 24, B = 34;
    const all = this.allWeights().filter((w) => w.date).sort((a, b) => a.date.localeCompare(b.date));
    const range = this.weightRange();
    const limit = range === 'all' || !all.length ? 0 : new Date(all[all.length - 1].date).getTime() - (range === '6m' ? 183 : 366) * 86_400_000;
    const data = all.filter((w) => !limit || new Date(w.date).getTime() >= limit);
    if (data.length === 0) return null;
    const t0 = new Date(data[0].date).getTime();
    const t1 = new Date(data[data.length - 1].date).getTime();
    const values = data.map((w) => w.weight);
    const lo = Math.floor(Math.min(...values) - 0.3);
    const hi = Math.ceil(Math.max(...values) + 0.3);
    const x = (t: number) => (t1 === t0 ? (L + W - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
    const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
    const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });
    const points = data.map((w) => ({ x: x(new Date(w.date).getTime()), y: y(w.weight), owner: w.source === 'OWNER', label: `${fmt(w.weight)} ${w.unit}` }));
    const steps = Math.min(4, Math.max(1, Math.round(hi - lo)));
    const grid = Array.from({ length: steps + 1 }, (_, i) => {
      const v = lo + ((hi - lo) * i) / steps;
      return { y: y(v), label: `${fmt(v)} kg` };
    });
    const months: { x: number; label: string }[] = [];
    const cursor = new Date(t0);
    cursor.setDate(1);
    while (cursor.getTime() <= t1 && months.length < 14) {
      if (cursor.getTime() >= t0 - 15 * 86_400_000) months.push({ x: x(Math.max(cursor.getTime(), t0)), label: cursor.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { W, H, L, R, points, grid, months, path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), last: points[points.length - 1], base: H - B };
  });

  protected confirmAllergy(a: AllergyEntry): void {
    this.add('allergyConfirm', a.id, { label: a.allergen });
  }

  protected editNeutered(): void {
    const n = this.neutered();
    this.add('neutered', undefined, { neuteredStatus: n && n.status !== 'UNKNOWN' ? n.status : 'YES', neuteredAt: n?.at });
  }

  protected newAppointment(): void {
    this.actions.newAppointment({ patientId: this.petId });
  }

  protected uploadDoc(): void {
    this.actions.toast('Subir documentos estará disponible pronto');
  }

  ngOnInit(): void {
    if (!this.petId) return;
    if (!this.store.patient(this.petId)) this.store.loadPeople().subscribe();
    this.load(this.summary, this.api.clinicalSummary(this.petId));
    this.load(this.allergies, this.api.allergies(this.petId));
    if (this.basicOnly()) return;
    this.load(this.dewormings, this.api.dewormings(this.petId));
    this.load(this.visits, this.api.visitsByPet(this.petId));
    this.load(this.vaccines, this.api.vaccines(this.petId));
    this.load(this.weights, this.api.weights(this.petId));
    this.load(this.surgeries, this.api.surgeries(this.petId));
    // Desde la ficha del paciente, "Registrar visita" llega con `?nueva=visita`: se abre el formulario una sola vez.
    if (!this.visitFormOpened && this.route.snapshot.queryParamMap.get('nueva') === 'visita' && this.canWriteClinical()) {
      this.visitFormOpened = true;
      setTimeout(() => this.add('visit'));
    }
  }

  private visitFormOpened = false;

  protected select(tab: HistoryTab): void {
    this.tab.set(tab);
    if ((tab === 'treatments' || tab === 'labs' || tab === 'visits') && !this.extrasLoaded && !this.visits().loading) this.loadExtras();
  }

  protected reload(): void {
    this.extrasLoaded = false;
    this.summary.set(empty(null));
    this.visits.set(empty([]));
    this.vaccines.set(empty([]));
    this.weights.set(empty([]));
    this.allergies.set(empty({ status: 'UNKNOWN', items: [] }));
    this.dewormings.set(empty(null));
    this.surgeries.set(empty([]));
    this.treatments.set({ data: [], loading: false, error: null });
    this.labs.set({ data: [], loading: false, error: null });
    this.ngOnInit();
  }

  protected add(kind: RecordKind, targetId?: string, extra: Partial<RecordData> = {}): void {
    const data: RecordData = { kind, petId: this.petId, visits: this.visits().data, targetId, ...extra };
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

  protected signed(n: number): string {
    return `${n > 0 ? '+' : ''}${String(n).replace('.', ',')}`;
  }

  /** Vacuna vigente / por vencer / vencida según la próxima dosis. */
  protected vaccineState(v: VaccineEntry): { label: string; tone: Tone } {
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
        // Tratamientos, laboratorio y consultas usan lo que cuelga de las visitas: si ya se abrió esa pestaña, se piden en cuanto llegan.
        if (!this.extrasLoaded && ['summary', 'treatments', 'labs', 'visits'].includes(this.tab()) && Array.isArray(data) && this.visits().data === data) this.loadExtras();
      },
      error: (e: unknown) => {
        const forbidden = (e as { status?: number })?.status === 403;
        target.update((p) => ({ ...p, loading: false, error: forbidden ? SHARED_HINT : errorMessage(e, 'No pudimos cargar esta parte de la historia.') }));
      },
    });
  }
}
