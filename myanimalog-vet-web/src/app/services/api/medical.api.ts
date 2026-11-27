import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { USER_API } from '@auth/auth.config';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { mapApiError } from '../api-error';

/**
 * Historia clínica (servicio Medical). Son las **mismas rutas** que usa la app del dueño (`/visits`, `/vaccines`, `/weight`…),
 * llamadas con el token de clínica: el autor y la clínica salen del token, así que no se manda `userId` ni `veterinaryId`.
 * Fuente: colección `Medical-Pet-Backend` (carpetas V1 a V7) y `docs/ADAPTACION_ENDPOINTS_VET.md`.
 *
 * El backend mezcla camelCase y snake_case y a veces envuelve la respuesta en `{ success, data, count }`:
 * cada método devuelve ya normalizado.
 */

export interface Visit {
  id: string;
  petId: string;
  date: string;
  reason: string;
  veterinarian: string;
  diagnosis: string;
  notes: string;
  anamnesis: string;
  physicalExam: string;
  plan: string;
  weight: number | null;
  temperature: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  mucousMembranes: string;
  bodyConditionScore: number | null;
  appointmentId: string | null;
  /** Clínica que la registró, si la respuesta la trae (`null` = la registró el dueño u otra clínica sin dato). */
  veterinaryId: string | null;
  veterinaryName: string;
}

export interface WeightEntry {
  id: string;
  petId: string;
  weight: number;
  unit: string;
  date: string;
  note: string;
  /** `CLINIC` o `OWNER`. */
  source: string;
}

export interface VaccineEntry {
  id: string;
  petId: string;
  name: string;
  applicationDate: string;
  nextDoseDate: string | null;
  lotNumber: string;
  manufacturer: string;
  veterinarian: string;
  notes: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  /** `ACTIVO`, `TERMINADO` o `REACCION`. */
  status: string;
  reactionNote: string;
}

export interface TreatmentEntry {
  id: string;
  visitId: string;
  description: string;
  startDate: string;
  endDate: string;
  notes: string;
  protocol: string;
  /** `ACTIVO`, `SUSPENDIDO`, `FINALIZADO`. */
  status: string;
  instructions: string;
  medications: Medication[];
}

export interface SurgeryEntry {
  id: string;
  petId: string;
  visitId: string;
  title: string;
  description: string;
  surgeryDate: string;
  durationMinutes: number | null;
  anesthesiaUsed: string;
  postOpInstructions: string;
  status: string;
  outcome: string;
  veterinarian: string;
  asaRisk: number | null;
  startsAt: string;
}

export interface LabParameter {
  parameter: string;
  result: string;
  unit: string;
  reference: string;
  /** `NORMAL`, `ALTO` o `BAJO`. */
  flag: string;
}

export interface LabEntry {
  id: string;
  visitId: string;
  name: string;
  result: string;
  normalRange: string;
  date: string;
  notes: string;
  isNormal: boolean | null;
  laboratoryName: string;
  veterinarian: string;
  /** `NORMAL`, `FUERA_DE_RANGO`… */
  status: string;
  interpretation: string;
  results: LabParameter[];
}

/** Alergia de la mascota (carpetas D9 y V10). `SUSPECTED` = la declaró el dueño; `CONFIRMED` = la confirmó un veterinario. */
export interface AllergyEntry {
  id: string;
  allergen: string;
  /** `DRUG`, `FOOD`, `ENVIRONMENT` u `OTHER`. */
  category: string;
  /** `MILD`, `MODERATE` o `SEVERE`. */
  severity: string;
  reaction: string;
  /** `SUSPECTED`, `CONFIRMED`, `RESOLVED` o `ENTERED_IN_ERROR`. */
  state: string;
  /** `OWNER` o `CLINIC`. */
  source: string;
  veterinaryName: string;
  recordedAt: string;
}

/** "No sé" no es "no tiene": `UNKNOWN` es distinto de `NONE_KNOWN`. */
export interface AllergyList {
  status: 'UNKNOWN' | 'NONE_KNOWN' | 'HAS_ALLERGIES';
  items: AllergyEntry[];
}

export interface NeuteredInfo {
  status: 'YES' | 'NO' | 'UNKNOWN';
  at: string;
  /** `OWNER` o `CLINIC`. */
  source: string;
  /** La confirmó una clínica. */
  confirmed: boolean;
}

export type DewormingType = 'INTERNAL' | 'EXTERNAL';

export interface DewormingEntry {
  id: string;
  kind: DewormingType;
  product: string;
  dose: string;
  weightKg: number | null;
  applicationDate: string;
  nextDoseDate: string;
  /** `OWNER` o `CLINIC`. */
  administeredBy: string;
  notes: string;
}

/** Última dosis de un tipo. */
export interface DewormingLast {
  kind: DewormingType;
  registered: boolean;
  lastApplicationDate: string;
  nextDoseDate: string;
  product: string;
}

export interface DewormingStatus {
  INTERNAL: DewormingLast;
  EXTERNAL: DewormingLast;
  /** Dosis anteriores, si el backend las manda además de la última por tipo. */
  history: DewormingEntry[];
}

export interface NewAllergy {
  petId: string;
  allergen: string;
  category: string;
  severity: string;
  reaction?: string;
}

export interface NewDeworming {
  petId: string;
  kind: DewormingType;
  product: string;
  applicationDate: string;
  dose?: string;
  weightKg?: number;
  nextDoseDate?: string;
  notes?: string;
}

/** Lo que ve recepción (`CLINICAL_READ_BASIC`) y la cabecera de la historia. La forma exacta la define el backend: se muestran los campos que lleguen. */
export interface ClinicalSummary {
  neutered: NeuteredInfo;
  allergies: string[];
  activeTreatments: string[];
  vaccines: { valid: number; dueSoon: number; overdue: number } | null;
  lastWeight: number | null;
  raw: Record<string, unknown>;
}

export interface NewVisit {
  petId: string;
  reason: string;
  date: string;
  veterinarian: string;
  diagnosis?: string;
  notes?: string;
  weight?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  mucousMembranes?: string;
  bodyConditionScore?: number;
  anamnesis?: string;
  physicalExam?: string;
  plan?: string;
  appointmentId?: string | null;
}

export interface NewWeight {
  petId: string;
  weight: number;
  unit: 'kg' | 'g' | 'lb';
  date: string;
  note?: string;
}

export interface NewVaccine {
  petId: string;
  name: string;
  applicationDate: string;
  nextDoseDate?: string;
  lotNumber?: string;
  manufacturer?: string;
  veterinarian?: string;
  notes?: string;
}

export interface NewTreatment {
  visitId: string;
  description: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  protocol?: string;
  status?: 'ACTIVO' | 'SUSPENDIDO' | 'FINALIZADO';
  instructions?: string;
}

/** Tipos de documento de la mascota (`documentType` de `POST /documents`). La colección solo muestra `LABORATORIO`. */
export const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'LABORATORIO', label: 'Laboratorio' },
  { value: 'IMAGEN_DIAGNOSTICA', label: 'Imagen diagnóstica' },
  { value: 'CONSENTIMIENTO', label: 'Consentimiento' },
  { value: 'FORMULA', label: 'Fórmula' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'VACUNAS', label: 'Vacunas' },
  { value: 'OTRO', label: 'Otro' },
];

/** V8. Documento de la mascota (resultado, imagen, consentimiento…). Solo lo ve y lo sube la clínica. */
export interface DocumentEntry {
  id: string;
  petId: string;
  visitId: string;
  type: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
  uploadedBy: string;
  /** Solo en el detalle: vence a los 10 minutos. */
  signedUrl: string;
}

export interface NewDocument {
  petId: string;
  file: File;
  documentType: string;
  title: string;
  visitId?: string;
}

export interface NewMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  startDate?: string;
  status?: 'ACTIVO' | 'TERMINADO' | 'REACCION';
}

export interface NewSurgery {
  petId: string;
  veterinaryVisitId: string;
  title: string;
  surgeryDate: string;
  description?: string;
  durationMinutes?: number;
  anesthesiaUsed?: string;
  postOpInstructions?: string;
  veterinarian?: string;
  startsAt?: string;
  asaRisk?: number;
}

export interface NewLab {
  /** El backend lo pide como `visit_id`. */
  visitId: string;
  name: string;
  date: string;
  veterinarian?: string;
  laboratoryName?: string;
  status?: string;
  interpretation?: string;
  results?: LabParameter[];
}

type Raw = Record<string, any>;

const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const pick = (r: Raw, ...keys: string[]): any => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};

/** `{ success, data, count }` o la lista/objeto directo. */
const unwrap = (res: unknown): any => (res && typeof res === 'object' && !Array.isArray(res) && 'data' in (res as Raw) ? (res as Raw)['data'] : res);
const list = (res: unknown): Raw[] => {
  const v = unwrap(res);
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const inner = (v as Raw)['items'] ?? (v as Raw)['content'] ?? (v as Raw)['results'];
    if (Array.isArray(inner)) return inner;
  }
  return [];
};

const toVisit = (r: Raw): Visit => ({
  id: text(r['id']),
  petId: text(pick(r, 'petId', 'pet_id')),
  date: text(pick(r, 'date', 'visitDate', 'visit_date')),
  reason: text(r['reason']),
  veterinarian: text(r['veterinarian']),
  diagnosis: text(r['diagnosis']),
  notes: text(r['notes']),
  anamnesis: text(r['anamnesis']),
  physicalExam: text(pick(r, 'physicalExam', 'physical_exam')),
  plan: text(r['plan']),
  weight: num(r['weight']),
  temperature: num(r['temperature']),
  heartRate: num(pick(r, 'heartRate', 'heart_rate')),
  respiratoryRate: num(pick(r, 'respiratoryRate', 'respiratory_rate')),
  mucousMembranes: text(pick(r, 'mucousMembranes', 'mucous_membranes')),
  bodyConditionScore: num(pick(r, 'bodyConditionScore', 'body_condition_score')),
  appointmentId: pick(r, 'appointmentId', 'appointment_id') ?? null,
  veterinaryId: pick(r, 'veterinaryId', 'veterinary_id') ?? null,
  veterinaryName: text(pick(r, 'veterinaryName', 'veterinary_name')),
});

const toWeight = (r: Raw): WeightEntry => ({
  id: text(r['id']),
  petId: text(pick(r, 'petId', 'pet_id')),
  weight: Number(r['weight']),
  unit: text(r['unit']) || 'kg',
  date: text(pick(r, 'date', 'measuredAt', 'created_at')),
  note: text(r['note']),
  source: text(pick(r, 'source', 'origin')),
});

const toVaccine = (r: Raw): VaccineEntry => ({
  id: text(r['id']),
  petId: text(pick(r, 'petId', 'pet_id')),
  name: text(pick(r, 'name', 'vaccineName', 'type')),
  applicationDate: text(pick(r, 'applicationDate', 'application_date', 'date')),
  nextDoseDate: pick(r, 'nextDoseDate', 'next_dose_date', 'nextDate') ?? null,
  lotNumber: text(pick(r, 'lotNumber', 'lot_number')),
  manufacturer: text(r['manufacturer']),
  veterinarian: text(r['veterinarian']),
  notes: text(r['notes']),
});

const toDocument = (r: Raw): DocumentEntry => ({
  id: text(r['id']),
  petId: text(pick(r, 'petId', 'pet_id')),
  visitId: text(pick(r, 'visitId', 'visit_id', 'veterinaryVisitId')),
  type: text(pick(r, 'documentType', 'document_type', 'type')),
  title: text(pick(r, 'title', 'name')),
  fileName: text(pick(r, 'fileName', 'file_name', 'originalName')),
  mimeType: text(pick(r, 'mimeType', 'mime_type', 'contentType')),
  sizeBytes: num(pick(r, 'fileSizeBytes', 'sizeBytes', 'size', 'file_size_bytes')),
  createdAt: text(pick(r, 'createdAt', 'created_at', 'uploadedAt', 'uploaded_at')),
  uploadedBy: text(pick(r, 'veterinaryName', 'uploadedByName', 'uploadedBy', 'veterinarian')),
  signedUrl: text(pick(r, 'signedUrl', 'signed_url', 'url', 'downloadUrl')),
});

const toMedication = (r: Raw): Medication => ({
  id: text(r['id']),
  name: text(r['name']),
  dosage: text(r['dosage']),
  frequency: text(r['frequency']),
  duration: text(r['duration']),
  status: text(r['status']),
  reactionNote: text(pick(r, 'reactionNote', 'reaction_note')),
});

const toTreatment = (r: Raw): TreatmentEntry => ({
  id: text(r['id']),
  visitId: text(pick(r, 'visitId', 'visit_id')),
  description: text(r['description']),
  startDate: text(pick(r, 'startDate', 'start_date')),
  endDate: text(pick(r, 'endDate', 'end_date')),
  notes: text(r['notes']),
  protocol: text(r['protocol']),
  status: text(r['status']),
  instructions: text(r['instructions']),
  medications: medicationsOf(r).map(toMedication),
});

/** Los medicamentos del tratamiento: el backend los nombra distinto según la ruta. `null` si la respuesta no los trae. */
const MEDICATION_KEYS = ['medications', 'medication', 'medicines', 'treatmentMedications', 'treatment_medications'];
const medicationsKey = (r: Raw): string | undefined => MEDICATION_KEYS.find((k) => Array.isArray(r[k]));
const medicationsOf = (r: Raw): Raw[] => {
  const key = medicationsKey(r);
  return key ? (r[key] as Raw[]) : [];
};

const toSurgery = (r: Raw): SurgeryEntry => ({
  id: text(r['id']),
  petId: text(pick(r, 'petId', 'pet_id')),
  visitId: text(pick(r, 'veterinaryVisitId', 'visitId', 'visit_id')),
  title: text(r['title']),
  description: text(r['description']),
  surgeryDate: text(pick(r, 'surgeryDate', 'surgery_date', 'date')),
  durationMinutes: num(pick(r, 'durationMinutes', 'duration_minutes')),
  anesthesiaUsed: text(pick(r, 'anesthesiaUsed', 'anesthesia_used')),
  postOpInstructions: text(pick(r, 'postOpInstructions', 'post_op_instructions')),
  status: text(r['status']),
  outcome: text(r['outcome']),
  veterinarian: text(r['veterinarian']),
  asaRisk: num(pick(r, 'asaRisk', 'asa_risk')),
  startsAt: text(pick(r, 'startsAt', 'starts_at')),
});

const toLab = (r: Raw): LabEntry => ({
  id: text(r['id']),
  visitId: text(pick(r, 'visitId', 'visit_id')),
  name: text(r['name']),
  result: text(r['result']),
  normalRange: text(pick(r, 'normalRange', 'normal_range')),
  date: text(r['date']),
  notes: text(r['notes']),
  isNormal: pick(r, 'isNormal', 'is_normal') ?? null,
  laboratoryName: text(pick(r, 'laboratoryName', 'laboratory_name')),
  veterinarian: text(r['veterinarian']),
  status: text(r['status']),
  interpretation: text(r['interpretation']),
  results: (Array.isArray(r['results']) ? r['results'] : []).map(
    (p: Raw): LabParameter => ({ parameter: text(p['parameter']), result: text(p['result']), unit: text(p['unit']), reference: text(p['reference']), flag: text(p['flag']) }),
  ),
});

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : text((x as Raw)?.['allergen'] ?? (x as Raw)?.['name'] ?? (x as Raw)?.['description']))).filter(Boolean) : []);

const day10 = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}/.test(text(v)) ? text(v).slice(0, 10) : '');

const toNeutered = (raw: unknown): NeuteredInfo => {
  const r: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const s = text(pick(r, 'status', 'neuteredStatus', 'neutered_status')).toUpperCase();
  const confirmed = pick(r, 'confirmedByEmployeeId', 'confirmed_by_employee_id', 'confirmedBy', 'confirmedAt');
  return {
    status: s === 'YES' || s === 'NO' ? s : 'UNKNOWN',
    at: day10(pick(r, 'at', 'neuteredAt', 'neutered_at', 'date')),
    source: text(pick(r, 'source', 'neuteredSource')).toUpperCase(),
    confirmed: !!confirmed,
  };
};

const toAllergy = (r: Raw): AllergyEntry => ({
  id: text(r['id']),
  allergen: text(pick(r, 'allergen', 'name')),
  category: text(r['category']).toUpperCase() || 'OTHER',
  severity: text(r['severity']).toUpperCase() || 'MILD',
  reaction: text(r['reaction']),
  state: text(r['status']).toUpperCase() || 'SUSPECTED',
  source: text(pick(r, 'source', 'origin')).toUpperCase(),
  veterinaryName: text(pick(r, 'veterinaryName', 'veterinary_name')),
  recordedAt: day10(pick(r, 'recordedAt', 'recorded_at', 'createdAt')),
});

const toAllergyList = (res: unknown): AllergyList => {
  const r = (unwrap(res) ?? {}) as Raw;
  const items = (Array.isArray(r) ? r : list(r['allergies'] ?? r)).filter((x) => x && typeof x === 'object').map(toAllergy);
  const s = text(pick(r, 'allergyStatus', 'allergy_status')).toUpperCase();
  const active = items.some((a) => a.state === 'SUSPECTED' || a.state === 'CONFIRMED');
  return { status: s === 'NONE_KNOWN' || s === 'HAS_ALLERGIES' || s === 'UNKNOWN' ? s : active ? 'HAS_ALLERGIES' : 'UNKNOWN', items };
};

const toDewormingEntry = (r: Raw, kind: DewormingType = 'INTERNAL'): DewormingEntry => ({
  id: text(pick(r, 'id', 'dewormingId')),
  kind: text(pick(r, 'kind', 'type')).toUpperCase() === 'EXTERNAL' ? 'EXTERNAL' : text(pick(r, 'kind', 'type')) ? 'INTERNAL' : kind,
  product: text(r['product']),
  dose: text(r['dose']),
  weightKg: num(pick(r, 'weightKg', 'weight_kg')),
  applicationDate: day10(pick(r, 'applicationDate', 'application_date', 'lastApplicationDate')),
  nextDoseDate: day10(pick(r, 'nextDoseDate', 'next_dose_date')),
  administeredBy: text(pick(r, 'administeredBy', 'administered_by')).toUpperCase(),
  notes: text(r['notes']),
});

/** `{ dewormings: { INTERNAL: { registered, lastApplicationDate… }, EXTERNAL: … } }` y, si llega, la lista de dosis. */
const toDewormings = (res: unknown): DewormingStatus => {
  const root = unwrap(res);
  const r: Raw = root && typeof root === 'object' && !Array.isArray(root) ? (root as Raw) : {};
  const byKind: Raw = r['dewormings'] && typeof r['dewormings'] === 'object' && !Array.isArray(r['dewormings']) ? r['dewormings'] : r['prevention'] && typeof r['prevention'] === 'object' ? r['prevention'] : r;
  const history = (Array.isArray(root) ? (root as Raw[]) : list(r['history'] ?? r['items'] ?? (Array.isArray(r['dewormings']) ? r['dewormings'] : [])))
    .filter((x) => x && typeof x === 'object' && text(x['status']).toUpperCase() !== 'ENTERED_IN_ERROR')
    .map((x) => toDewormingEntry(x))
    .sort((a, b) => b.applicationDate.localeCompare(a.applicationDate));
  const make = (kind: DewormingType): DewormingLast => {
    const s: Raw = byKind[kind] && typeof byKind[kind] === 'object' ? byKind[kind] : {};
    const own = history.find((h) => h.kind === kind);
    const last = day10(pick(s, 'lastApplicationDate', 'last_application_date', 'applicationDate')) || own?.applicationDate || '';
    return { kind, registered: s['registered'] === false ? false : !!(s['registered'] || last), lastApplicationDate: last, nextDoseDate: day10(pick(s, 'nextDoseDate', 'next_dose_date')) || own?.nextDoseDate || '', product: text(s['product']) || own?.product || '' };
  };
  return { INTERNAL: make('INTERNAL'), EXTERNAL: make('EXTERNAL'), history };
};

const toSummary = (res: unknown): ClinicalSummary => {
  const r = (unwrap(res) ?? {}) as Raw;
  const v = r['vaccines'];
  const vaccines =
    v && typeof v === 'object' && !Array.isArray(v)
      ? { valid: Number(pick(v, 'valid', 'current', 'vigentes') ?? 0), dueSoon: Number(pick(v, 'dueSoon', 'due_soon', 'porVencer') ?? 0), overdue: Number(pick(v, 'overdue', 'vencidas') ?? 0) }
      : null;
  return {
    neutered: toNeutered(r['neutered']),
    allergies: strings((Array.isArray(r['allergies']) ? (r['allergies'] as unknown[]) : []).filter((a) => typeof a === 'string' || !['RESOLVED', 'ENTERED_IN_ERROR'].includes(text((a as Raw)?.['status']).toUpperCase()))),
    activeTreatments: strings(pick(r, 'activeTreatments', 'active_treatments')),
    vaccines,
    lastWeight: num(pick(r, 'lastWeight', 'last_weight', 'latestWeight')),
    raw: r,
  };
};

@Injectable({ providedIn: 'root' })
export class MedicalApi {
  private readonly http = inject(HttpClient);

  // ---- Lectura ----

  /** V7. Alergias, vacunas, tratamientos activos y último peso. Es lo único que ve recepción. */
  clinicalSummary(petId: string): Observable<ClinicalSummary> {
    return this.http.get<unknown>(`${USER_API}/pets/${petId}/clinical-summary`).pipe(map(toSummary), mapApiError());
  }

  /** V1. Visitas de la mascota (de todas las clínicas que ella compartió). */
  visitsByPet(petId: string): Observable<Visit[]> {
    return this.http.get<unknown>(`${USER_API}/visits/pet/${petId}`).pipe(map((r) => list(r).map(toVisit)), mapApiError());
  }

  /** V1. Visitas que registró **mi** clínica entre dos fechas (`YYYY-MM-DD`). */
  clinicVisits(veterinaryId: string, from: string, to: string): Observable<Visit[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<unknown>(`${USER_API}/visits/veterinary/${veterinaryId}`, { params }).pipe(map((r) => list(r).map(toVisit)), mapApiError());
  }

  /** V2. Historial de peso (clínica y dueño). */
  weights(petId: string): Observable<WeightEntry[]> {
    const params = new HttpParams().set('petId', petId);
    return this.http.get<unknown>(`${USER_API}/weight`, { params }).pipe(map((r) => list(r).map(toWeight)), mapApiError());
  }

  /** V3. Carnet de vacunas. */
  vaccines(petId: string): Observable<VaccineEntry[]> {
    const params = new HttpParams().set('petId', petId);
    return this.http.get<unknown>(`${USER_API}/vaccines`, { params }).pipe(map((r) => list(r).map(toVaccine)), mapApiError());
  }

  /** V5. Cirugías de la mascota. */
  surgeries(petId: string): Observable<SurgeryEntry[]> {
    return this.http.get<unknown>(`${USER_API}/surgery/pet/${petId}`).pipe(map((r) => list(r).map(toSurgery)), mapApiError());
  }

  /** V1. Tratamientos de una visita. No hay un listado por mascota: se piden por visita. */
  treatmentsByVisit(visitId: string): Observable<TreatmentEntry[]> {
    return this.http.get<unknown>(`${USER_API}/visits/${visitId}/treatment`).pipe(
      mapApiError(),
      // El listado de la visita puede venir sin los medicamentos: esos tratamientos se completan con `GET /treatments/{id}`.
      switchMap((res) => {
        const rows = list(res);
        if (!rows.length) return of<TreatmentEntry[]>([]);
        return forkJoin(rows.map((row) => (medicationsKey(row) || !row['id'] ? of(toTreatment(row)) : this.treatment(text(row['id']), row))));
      }),
    );
  }

  /** `GET /treatments/{id}` con sus medicamentos. Si falla, queda lo que traía el listado. */
  private treatment(id: string, fallback: Raw): Observable<TreatmentEntry> {
    return this.http.get<unknown>(`${USER_API}/treatments/${id}`).pipe(
      map((r) => {
        const full = (unwrap(r) ?? {}) as Raw;
        return toTreatment({ ...fallback, ...full, medications: medicationsOf(full) });
      }),
      catchError(() => of(toTreatment(fallback))),
    );
  }

  /** V6. Laboratorios de una visita. No hay un listado por mascota: se piden por visita. */
  labsByVisit(visitId: string): Observable<LabEntry[]> {
    const params = new HttpParams().set('visit_id', visitId);
    return this.http.get<unknown>(`${USER_API}/lab`, { params }).pipe(map((r) => list(r).map(toLab)), mapApiError());
  }

  /** Tratamientos y laboratorios de varias visitas a la vez (las que falle una, se saltan). */
  treatmentsOf(visits: Visit[]): Observable<TreatmentEntry[]> {
    return this.gather(visits, (v) => this.treatmentsByVisit(v.id));
  }

  labsOf(visits: Visit[]): Observable<LabEntry[]> {
    return this.gather(visits, (v) => this.labsByVisit(v.id));
  }

  // ---- Escritura (el autor sale del token; el backend decide por rol y tarjeta) ----

  /** V1. `CLINICAL_WRITE` + tarjeta verificada. Si viene de una cita, primero se marca como atendida (una visita por cita). */
  createVisit(body: NewVisit): Observable<Visit> {
    return this.http.post<unknown>(`${USER_API}/visits`, body).pipe(map((r) => toVisit((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V2. `NURSING_WRITE`: queda con `source = CLINIC`. */
  addWeight(body: NewWeight): Observable<WeightEntry> {
    return this.http.post<unknown>(`${USER_API}/weight`, body).pipe(map((r) => toWeight((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V3. `NURSING_WRITE`: aplica la vacuna y deja el carnet del dueño al día. */
  applyVaccine(body: NewVaccine): Observable<VaccineEntry> {
    return this.http.post<unknown>(`${USER_API}/vaccines`, body).pipe(map((r) => toVaccine((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V4. `CLINICAL_WRITE` + tarjeta. Cuelga de una visita. */
  createTreatment(body: NewTreatment): Observable<TreatmentEntry> {
    return this.http.post<unknown>(`${USER_API}/treatments`, body).pipe(map((r) => toTreatment((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V8. Documentos de la mascota (los más nuevos primero). */
  documents(petId: string): Observable<DocumentEntry[]> {
    const params = new HttpParams().set('petId', petId);
    return this.http.get<unknown>(`${USER_API}/documents`, { params }).pipe(
      map((r) => list(r).map(toDocument).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      mapApiError(),
    );
  }

  /** V8. Sube un PDF, JPG o PNG (máx. 10 MB) en multipart. */
  uploadDocument(d: NewDocument): Observable<DocumentEntry> {
    const form = new FormData();
    form.append('file', d.file, d.file.name);
    form.append('petId', d.petId);
    form.append('documentType', d.documentType);
    form.append('title', d.title);
    if (d.visitId) form.append('visitId', d.visitId);
    return this.http.post<unknown>(`${USER_API}/documents`, form).pipe(map((r) => toDocument((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V8. Detalle con la URL firmada (10 minutos) para abrir el archivo. */
  document(documentId: string): Observable<DocumentEntry> {
    return this.http.get<unknown>(`${USER_API}/documents/${documentId}`).pipe(map((r) => toDocument((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V8. Solo la clínica que lo subió (`403` si no). */
  deleteDocument(documentId: string): Observable<unknown> {
    return this.http.delete<unknown>(`${USER_API}/documents/${documentId}`).pipe(mapApiError());
  }

  /** V4. Agrega un medicamento a un tratamiento. */
  addMedication(treatmentId: string, body: NewMedication): Observable<unknown> {
    return this.http.post<unknown>(`${USER_API}/treatments/${treatmentId}/add-medication`, body).pipe(mapApiError());
  }

  /** V4. Suspende o termina un tratamiento. El PUT ya no existe: se corrige en `/corrections` con un motivo obligatorio. */
  updateTreatment(treatmentId: string, body: { status?: string; suspensionReason?: string; notes?: string }, reason: string): Observable<unknown> {
    return this.http.post<unknown>(`${USER_API}/treatments/${treatmentId}/corrections`, { ...body, reason }).pipe(mapApiError());
  }

  // ---- Salud de la mascota: alergias, esterilización y desparasitación (carpetas D9 y V10) ----

  /** Alergias y estado general. `CLINICAL_READ_BASIC`: también las ve recepción. */
  allergies(petId: string): Observable<AllergyList> {
    const params = new HttpParams().set('petId', petId);
    return this.http.get<unknown>(`${USER_API}/allergies`, { params }).pipe(map(toAllergyList), mapApiError());
  }

  /** La clínica registra una alergia nueva: queda `CONFIRMED`. Veterinario con tarjeta (`CLINICAL_WRITE`). */
  addAllergy(body: NewAllergy): Observable<unknown> {
    return this.http.post<unknown>(`${USER_API}/allergies`, body).pipe(mapApiError());
  }

  /** Confirma una alergia que declaró el dueño (`SUSPECTED` → `CONFIRMED`). Solo veterinario con tarjeta. */
  confirmAllergy(id: string, reason: string): Observable<unknown> {
    return this.http.post<unknown>(`${USER_API}/allergies/${id}/confirm`, { reason }).pipe(mapApiError());
  }

  /** Esterilización confirmada por la clínica (queda con el empleado que la confirmó). */
  setNeutered(petId: string, status: 'YES' | 'NO' | 'UNKNOWN', at?: string): Observable<NeuteredInfo> {
    const body: { neuteredStatus: string; neuteredAt?: string } = { neuteredStatus: status };
    if (status === 'YES' && at) body.neuteredAt = at;
    return this.http.put<Raw>(`${USER_API}/pets/${petId}/clinical-profile`, body).pipe(map((r) => toNeutered(r?.['neutered'] ?? r?.['data']?.['neutered'])), mapApiError());
  }

  /** Última dosis por tipo y, si el backend la manda, el historial. */
  dewormings(petId: string): Observable<DewormingStatus> {
    const params = new HttpParams().set('petId', petId);
    return this.http.get<unknown>(`${USER_API}/dewormings`, { params }).pipe(map(toDewormings), mapApiError());
  }

  /** `NURSING_WRITE` (auxiliar y veterinario): queda con origen clínica. */
  addDeworming(body: NewDeworming): Observable<unknown> {
    return this.http.post<unknown>(`${USER_API}/dewormings`, body).pipe(mapApiError());
  }

  /** V5. Programa una cirugía. Cuelga de una visita. */
  createSurgery(body: NewSurgery): Observable<SurgeryEntry> {
    return this.http.post<unknown>(`${USER_API}/surgery`, body).pipe(map((r) => toSurgery((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  /** V5. Cambia el estado (`status`: `completed`, …) y el resultado. */
  updateSurgeryStatus(id: string, body: { status: string; outcome?: string }): Observable<unknown> {
    return this.http.patch<unknown>(`${USER_API}/surgery/${id}`, body).pipe(mapApiError());
  }

  /** V6. Crea un examen con sus parámetros. El backend espera `visit_id`. */
  createLab(body: NewLab): Observable<LabEntry> {
    const { visitId, ...rest } = body;
    return this.http.post<unknown>(`${USER_API}/lab`, { ...rest, visit_id: visitId }).pipe(map((r) => toLab((unwrap(r) ?? {}) as Raw)), mapApiError());
  }

  private gather<R>(visits: Visit[], one: (v: Visit) => Observable<R[]>): Observable<R[]> {
    if (!visits.length) return of([]);
    return forkJoin(visits.map((v) => new Observable<R[]>((s) => one(v).subscribe({ next: (x) => (s.next(x), s.complete()), error: () => (s.next([]), s.complete()) })))).pipe(map((all) => all.flat()));
  }
}
