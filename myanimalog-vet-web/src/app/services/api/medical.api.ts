import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { USER_API } from '@auth/auth.config';
import { forkJoin, map, Observable, of } from 'rxjs';
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

/** Lo que ve recepción (`CLINICAL_READ_BASIC`) y la cabecera de la historia. La forma exacta la define el backend: se muestran los campos que lleguen. */
export interface ClinicalSummary {
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
  medications: (Array.isArray(r['medications']) ? r['medications'] : []).map(toMedication),
});

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

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : text((x as Raw)?.['name'] ?? (x as Raw)?.['description']))).filter(Boolean) : []);

const toSummary = (res: unknown): ClinicalSummary => {
  const r = (unwrap(res) ?? {}) as Raw;
  const v = r['vaccines'];
  const vaccines =
    v && typeof v === 'object' && !Array.isArray(v)
      ? { valid: Number(pick(v, 'valid', 'current', 'vigentes') ?? 0), dueSoon: Number(pick(v, 'dueSoon', 'due_soon', 'porVencer') ?? 0), overdue: Number(pick(v, 'overdue', 'vencidas') ?? 0) }
      : null;
  return {
    allergies: strings(r['allergies']),
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
    return this.http.get<unknown>(`${USER_API}/visits/${visitId}/treatment`).pipe(map((r) => list(r).map(toTreatment)), mapApiError());
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

  /** V4. Agrega un medicamento a un tratamiento. */
  addMedication(treatmentId: string, body: NewMedication): Observable<unknown> {
    return this.http.post<unknown>(`${USER_API}/treatments/${treatmentId}/add-medication`, body).pipe(mapApiError());
  }

  /** V4. Suspende o termina un tratamiento (`status`, `suspensionReason`). */
  updateTreatment(treatmentId: string, body: { status?: string; suspensionReason?: string; notes?: string }): Observable<unknown> {
    return this.http.put<unknown>(`${USER_API}/treatments/${treatmentId}`, body).pipe(mapApiError());
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
