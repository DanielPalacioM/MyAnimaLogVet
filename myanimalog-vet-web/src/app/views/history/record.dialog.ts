import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SessionService } from '@auth/services/session.service';
import { errorMessage } from '@services/api-error';
import { MedicalApi, Visit } from '@services/api/medical.api';
import { VetField } from '@shared/components/form-field/form-field.component';
import { VetModal } from '@shared/components/modal/modal.component';
import { Observable } from 'rxjs';

export type RecordKind = 'weight' | 'vaccine' | 'visit' | 'treatment' | 'medication' | 'surgery' | 'lab' | 'surgeryStatus';
export interface RecordData {
  kind: RecordKind;
  petId: string;
  /** Consultas de la mascota: tratamiento, cirugía y examen cuelgan de una. */
  visits?: Visit[];
  /** Para agregar un medicamento o cambiar el estado de una cirugía. */
  targetId?: string;
}

const TITLES: Record<RecordKind, { title: string; subtitle: string; save: string }> = {
  weight: { title: 'Registrar peso', subtitle: 'Queda con el nombre de tu clínica. El dueño lo ve en la app.', save: 'Guardar peso' },
  vaccine: { title: 'Aplicar vacuna', subtitle: 'Se agrega al carnet de la mascota y el dueño la ve en su app.', save: 'Guardar vacuna' },
  visit: { title: 'Registrar visita', subtitle: 'La consulta queda a tu nombre, con fecha y hora.', save: 'Guardar consulta' },
  treatment: { title: 'Nuevo tratamiento', subtitle: 'Se agrega a una consulta de la mascota. Después puedes añadirle medicamentos.', save: 'Guardar tratamiento' },
  medication: { title: 'Agregar medicamento', subtitle: 'Dosis, frecuencia y duración.', save: 'Agregar' },
  surgery: { title: 'Programar cirugía', subtitle: 'Se agrega a una consulta de la mascota. El dueño la ve en su app.', save: 'Guardar cirugía' },
  surgeryStatus: { title: 'Cambiar estado de la cirugía', subtitle: 'Queda registrado con tu nombre.', save: 'Guardar estado' },
  lab: { title: 'Agregar examen', subtitle: 'Resultado y parámetros con su rango normal.', save: 'Guardar examen' },
};

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Registrar peso, aplicar vacuna o registrar una visita. Cierra con `true` si se guardó. */
@Component({
  selector: 'vet-record-dialog',
  imports: [ReactiveFormsModule, VetModal, VetField],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <vet-modal [title]="text.title" [subtitle]="text.subtitle">
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }

        @switch (data.kind) {
          @case ('weight') {
            <div class="row">
              <vet-field label="Peso" for="rc-weight" [control]="form.controls['weight']" [messages]="{ required: 'Escribe el peso.', min: 'Debe ser mayor que 0.' }">
                <input id="rc-weight" class="vet-input" type="number" step="0.1" min="0.1" formControlName="weight" />
              </vet-field>
              <vet-field label="Unidad" for="rc-unit" [control]="form.controls['unit']">
                <select id="rc-unit" class="vet-input" formControlName="unit">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lb">lb</option>
                </select>
              </vet-field>
            </div>
            <vet-field label="Fecha" for="rc-date" [control]="form.controls['date']" [messages]="{ required: 'Elige la fecha.' }">
              <input id="rc-date" class="vet-input" type="date" formControlName="date" />
            </vet-field>
            <vet-field label="Nota" for="rc-note" [control]="form.controls['note']" [optional]="true">
              <input id="rc-note" class="vet-input" formControlName="note" placeholder="Ej. Control de consulta" autocomplete="off" />
            </vet-field>
          }
          @case ('vaccine') {
            <vet-field label="Vacuna" for="rc-name" [control]="form.controls['name']" [messages]="{ required: 'Escribe el nombre de la vacuna.' }">
              <input id="rc-name" class="vet-input" formControlName="name" placeholder="Ej. Antirrábica" autocomplete="off" />
            </vet-field>
            <div class="row">
              <vet-field label="Aplicada el" for="rc-app" [control]="form.controls['applicationDate']" [messages]="{ required: 'Elige la fecha.' }">
                <input id="rc-app" class="vet-input" type="date" formControlName="applicationDate" />
              </vet-field>
              <vet-field label="Próxima dosis" for="rc-next" [control]="form.controls['nextDoseDate']" [optional]="true">
                <input id="rc-next" class="vet-input" type="date" formControlName="nextDoseDate" />
              </vet-field>
            </div>
            <div class="row">
              <vet-field label="Lote" for="rc-lot" [control]="form.controls['lotNumber']" [optional]="true">
                <input id="rc-lot" class="vet-input" formControlName="lotNumber" autocomplete="off" />
              </vet-field>
              <vet-field label="Laboratorio" for="rc-man" [control]="form.controls['manufacturer']" [optional]="true">
                <input id="rc-man" class="vet-input" formControlName="manufacturer" autocomplete="off" />
              </vet-field>
            </div>
            <vet-field label="Notas" for="rc-notes" [control]="form.controls['notes']" [optional]="true">
              <input id="rc-notes" class="vet-input" formControlName="notes" placeholder="Ej. Sin reacciones" autocomplete="off" />
            </vet-field>
          }
          @case ('visit') {
            <div class="row">
              <vet-field label="Motivo" for="rc-reason" [control]="form.controls['reason']" [messages]="{ required: 'Escribe el motivo.' }">
                <input id="rc-reason" class="vet-input" formControlName="reason" placeholder="Ej. Control posoperatorio" autocomplete="off" />
              </vet-field>
              <vet-field label="Fecha" for="rc-vdate" [control]="form.controls['date']" [messages]="{ required: 'Elige la fecha.' }">
                <input id="rc-vdate" class="vet-input" type="date" formControlName="date" />
              </vet-field>
            </div>
            <div class="row four">
              <vet-field label="Peso (kg)" for="rc-vw" [control]="form.controls['weight']" [optional]="true">
                <input id="rc-vw" class="vet-input" type="number" step="0.1" min="0" formControlName="weight" />
              </vet-field>
              <vet-field label="Temp. (°C)" for="rc-vt" [control]="form.controls['temperature']" [optional]="true">
                <input id="rc-vt" class="vet-input" type="number" step="0.1" min="0" formControlName="temperature" />
              </vet-field>
              <vet-field label="F. cardíaca" for="rc-vh" [control]="form.controls['heartRate']" [optional]="true">
                <input id="rc-vh" class="vet-input" type="number" min="0" formControlName="heartRate" />
              </vet-field>
              <vet-field label="F. respiratoria" for="rc-vr" [control]="form.controls['respiratoryRate']" [optional]="true">
                <input id="rc-vr" class="vet-input" type="number" min="0" formControlName="respiratoryRate" />
              </vet-field>
            </div>
            <vet-field label="Anamnesis" for="rc-an" [control]="form.controls['anamnesis']" [optional]="true">
              <textarea id="rc-an" class="vet-input" rows="2" formControlName="anamnesis"></textarea>
            </vet-field>
            <vet-field label="Examen físico" for="rc-ex" [control]="form.controls['physicalExam']" [optional]="true">
              <textarea id="rc-ex" class="vet-input" rows="2" formControlName="physicalExam"></textarea>
            </vet-field>
            <vet-field label="Diagnóstico" for="rc-dx" [control]="form.controls['diagnosis']" [optional]="true">
              <textarea id="rc-dx" class="vet-input" rows="2" formControlName="diagnosis"></textarea>
            </vet-field>
            <vet-field label="Plan" for="rc-plan" [control]="form.controls['plan']" [optional]="true">
              <textarea id="rc-plan" class="vet-input" rows="2" formControlName="plan"></textarea>
            </vet-field>
          }

          @case ('treatment') {
            <vet-field label="Consulta" for="rc-visit" [control]="form.controls['visitId']" [messages]="{ required: 'Elige la consulta.' }">
              <select id="rc-visit" class="vet-input" formControlName="visitId">
                <option value="" disabled>Elige una consulta</option>
                @for (v of visits; track v.id) { <option [value]="v.id">{{ v.date }} · {{ v.reason || 'Consulta' }}</option> }
              </select>
            </vet-field>
            <vet-field label="Diagnóstico o descripción" for="rc-desc" [control]="form.controls['description']" [messages]="{ required: 'Escribe la descripción.' }">
              <input id="rc-desc" class="vet-input" formControlName="description" placeholder="Ej. Dermatitis atópica" autocomplete="off" />
            </vet-field>
            <div class="row">
              <vet-field label="Inicia" for="rc-start" [control]="form.controls['startDate']" [messages]="{ required: 'Elige la fecha.' }">
                <input id="rc-start" class="vet-input" type="date" formControlName="startDate" />
              </vet-field>
              <vet-field label="Termina" for="rc-end" [control]="form.controls['endDate']" [optional]="true">
                <input id="rc-end" class="vet-input" type="date" formControlName="endDate" />
              </vet-field>
            </div>
            <vet-field label="Protocolo" for="rc-proto" [control]="form.controls['protocol']" [optional]="true">
              <input id="rc-proto" class="vet-input" formControlName="protocol" autocomplete="off" />
            </vet-field>
            <vet-field label="Indicaciones para el dueño" for="rc-inst" [control]="form.controls['instructions']" [optional]="true">
              <textarea id="rc-inst" class="vet-input" rows="2" formControlName="instructions"></textarea>
            </vet-field>
          }
          @case ('medication') {
            <vet-field label="Medicamento" for="rc-mname" [control]="form.controls['name']" [messages]="{ required: 'Escribe el medicamento.' }">
              <input id="rc-mname" class="vet-input" formControlName="name" placeholder="Ej. Clindamicina 150 mg" autocomplete="off" />
            </vet-field>
            <div class="row">
              <vet-field label="Dosis" for="rc-dose" [control]="form.controls['dosage']" [messages]="{ required: 'Escribe la dosis.' }">
                <input id="rc-dose" class="vet-input" formControlName="dosage" autocomplete="off" />
              </vet-field>
              <vet-field label="Frecuencia" for="rc-freq" [control]="form.controls['frequency']" [messages]="{ required: 'Escribe la frecuencia.' }">
                <input id="rc-freq" class="vet-input" formControlName="frequency" placeholder="Ej. cada 12 h" autocomplete="off" />
              </vet-field>
            </div>
            <vet-field label="Duración" for="rc-dur" [control]="form.controls['duration']" [messages]="{ required: 'Escribe la duración.' }">
              <input id="rc-dur" class="vet-input" formControlName="duration" placeholder="Ej. 7 días" autocomplete="off" />
            </vet-field>
          }
          @case ('surgery') {
            <vet-field label="Consulta" for="rc-svisit" [control]="form.controls['veterinaryVisitId']" [messages]="{ required: 'Elige la consulta.' }">
              <select id="rc-svisit" class="vet-input" formControlName="veterinaryVisitId">
                <option value="" disabled>Elige una consulta</option>
                @for (v of visits; track v.id) { <option [value]="v.id">{{ v.date }} · {{ v.reason || 'Consulta' }}</option> }
              </select>
            </vet-field>
            <vet-field label="Cirugía" for="rc-title" [control]="form.controls['title']" [messages]="{ required: 'Escribe el nombre.' }">
              <input id="rc-title" class="vet-input" formControlName="title" placeholder="Ej. Esterilización" autocomplete="off" />
            </vet-field>
            <div class="row">
              <vet-field label="Fecha" for="rc-sdate" [control]="form.controls['surgeryDate']" [messages]="{ required: 'Elige la fecha.' }">
                <input id="rc-sdate" class="vet-input" type="date" formControlName="surgeryDate" />
              </vet-field>
              <vet-field label="Duración (min)" for="rc-sdur" [control]="form.controls['durationMinutes']" [optional]="true">
                <input id="rc-sdur" class="vet-input" type="number" min="1" formControlName="durationMinutes" />
              </vet-field>
            </div>
            <div class="row">
              <vet-field label="Anestesia" for="rc-anes" [control]="form.controls['anesthesiaUsed']" [optional]="true">
                <input id="rc-anes" class="vet-input" formControlName="anesthesiaUsed" autocomplete="off" />
              </vet-field>
              <vet-field label="Riesgo ASA (1 a 5)" for="rc-asa" [control]="form.controls['asaRisk']" [optional]="true">
                <input id="rc-asa" class="vet-input" type="number" min="1" max="5" formControlName="asaRisk" />
              </vet-field>
            </div>
            <vet-field label="Descripción" for="rc-sdesc" [control]="form.controls['description']" [optional]="true">
              <textarea id="rc-sdesc" class="vet-input" rows="2" formControlName="description"></textarea>
            </vet-field>
            <vet-field label="Instrucciones posoperatorias" for="rc-post" [control]="form.controls['postOpInstructions']" [optional]="true">
              <textarea id="rc-post" class="vet-input" rows="2" formControlName="postOpInstructions"></textarea>
            </vet-field>
          }
          @case ('surgeryStatus') {
            <vet-field label="Estado" for="rc-stat" [control]="form.controls['status']" [messages]="{ required: 'Elige el estado.' }">
              <select id="rc-stat" class="vet-input" formControlName="status">
                <option value="scheduled">Programada</option>
                <option value="in_progress">En curso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </vet-field>
            <vet-field label="Resultado" for="rc-out" [control]="form.controls['outcome']" [optional]="true">
              <input id="rc-out" class="vet-input" formControlName="outcome" placeholder="Ej. Sin complicaciones" autocomplete="off" />
            </vet-field>
          }
          @case ('lab') {
            <vet-field label="Consulta" for="rc-lvisit" [control]="form.controls['visitId']" [messages]="{ required: 'Elige la consulta.' }">
              <select id="rc-lvisit" class="vet-input" formControlName="visitId">
                <option value="" disabled>Elige una consulta</option>
                @for (v of visits; track v.id) { <option [value]="v.id">{{ v.date }} · {{ v.reason || 'Consulta' }}</option> }
              </select>
            </vet-field>
            <div class="row">
              <vet-field label="Examen" for="rc-lname" [control]="form.controls['name']" [messages]="{ required: 'Escribe el nombre.' }">
                <input id="rc-lname" class="vet-input" formControlName="name" placeholder="Ej. Hemograma" autocomplete="off" />
              </vet-field>
              <vet-field label="Fecha" for="rc-ldate" [control]="form.controls['date']" [messages]="{ required: 'Elige la fecha.' }">
                <input id="rc-ldate" class="vet-input" type="date" formControlName="date" />
              </vet-field>
            </div>
            <div class="row">
              <vet-field label="Laboratorio" for="rc-lab" [control]="form.controls['laboratoryName']" [optional]="true">
                <input id="rc-lab" class="vet-input" formControlName="laboratoryName" autocomplete="off" />
              </vet-field>
              <vet-field label="Resultado general" for="rc-lstat" [control]="form.controls['status']">
                <select id="rc-lstat" class="vet-input" formControlName="status">
                  <option value="NORMAL">Normal</option>
                  <option value="FUERA_DE_RANGO">Fuera de rango</option>
                </select>
              </vet-field>
            </div>
            <fieldset formArrayName="params">
              <legend>Parámetros</legend>
              @for (p of params.controls; track $index; let i = $index) {
                <div class="param" [formGroupName]="i">
                  <input class="vet-input" formControlName="parameter" placeholder="Parámetro" aria-label="Parámetro" />
                  <input class="vet-input" formControlName="result" placeholder="Resultado" aria-label="Resultado" />
                  <input class="vet-input" formControlName="unit" placeholder="Unidad" aria-label="Unidad" />
                  <input class="vet-input" formControlName="reference" placeholder="Rango normal" aria-label="Rango normal" />
                  <select class="vet-input" formControlName="flag" aria-label="Marca">
                    <option value="NORMAL">Normal</option>
                    <option value="ALTO">Alto</option>
                    <option value="BAJO">Bajo</option>
                  </select>
                  <button type="button" class="x" (click)="removeParam(i)" aria-label="Quitar parámetro">×</button>
                </div>
              }
              <button type="button" class="add" (click)="addParam()">+ Agregar parámetro</button>
            </fieldset>
            <vet-field label="Interpretación" for="rc-interp" [control]="form.controls['interpretation']" [optional]="true">
              <textarea id="rc-interp" class="vet-input" rows="2" formControlName="interpretation"></textarea>
            </vet-field>
          }
        }

        <ng-container footer>
          <button type="button" class="btn btn--ghost" (click)="ref.close()">Cancelar</button>
          <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Guardando…' : text.save }}</button>
        </ng-container>
      </vet-modal>
    </form>
  `,
  styles: `
    :host { display: block; width: min(560px, 92vw); max-height: 90vh; overflow-y: auto; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row.four { grid-template-columns: repeat(4, 1fr); }
    .error { margin: 0; padding: 10px 12px; border-radius: 8px; background: #fef3f2; color: #b42318; font: 700 13px/1.35 'Afacad', sans-serif; }
    .btn { height: 41px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 15px/1 'Afacad', sans-serif; cursor: pointer; }
    .btn:disabled { opacity: 0.6; cursor: default; }
    .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
    fieldset { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: 6px; padding: 0; font: 700 16px/1.3 'Afacad', sans-serif; }
    .param { display: grid; grid-template-columns: 1.4fr 0.8fr 0.7fr 1fr 0.8fr auto; gap: 6px; }
    .x { border: 0; background: none; color: #b42318; font: 700 20px/1 'Afacad', sans-serif; cursor: pointer; }
    .add { justify-self: start; border: 0; background: none; color: #4037be; font: 700 14px/1 'Afacad', sans-serif; cursor: pointer; }
    @media (max-width: 700px) { .param { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 560px) { .row, .row.four { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordDialog {
  protected readonly data = inject<RecordData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<RecordDialog, boolean>>(MatDialogRef);
  private readonly api = inject(MedicalApi);
  private readonly session = inject(SessionService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly text = TITLES[this.data.kind];
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly visits: Visit[] = [...(this.data.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  protected readonly form: FormGroup = this.buildForm();
  protected get params(): FormArray {
    return this.form.controls['params'] as FormArray;
  }

  private buildForm(): FormGroup {
    const firstVisit = this.visits[0]?.id ?? '';
    const groups: Record<RecordKind, Record<string, unknown>> = {
      weight: { weight: [0, [Validators.required, Validators.min(0.1)]], unit: ['kg'], date: [today(), Validators.required], note: [''] },
      vaccine: { name: ['', Validators.required], applicationDate: [today(), Validators.required], nextDoseDate: [''], lotNumber: [''], manufacturer: [''], notes: [''] },
      visit: { reason: ['', Validators.required], date: [today(), Validators.required], weight: [''], temperature: [''], heartRate: [''], respiratoryRate: [''], anamnesis: [''], physicalExam: [''], diagnosis: [''], plan: [''] },
      treatment: { visitId: [firstVisit, Validators.required], description: ['', Validators.required], startDate: [today(), Validators.required], endDate: [''], protocol: [''], instructions: [''] },
      medication: { name: ['', Validators.required], dosage: ['', Validators.required], frequency: ['', Validators.required], duration: ['', Validators.required] },
      surgery: { veterinaryVisitId: [firstVisit, Validators.required], title: ['', Validators.required], surgeryDate: [today(), Validators.required], durationMinutes: [''], anesthesiaUsed: [''], asaRisk: [''], description: [''], postOpInstructions: [''] },
      surgeryStatus: { status: ['completed', Validators.required], outcome: [''] },
      lab: { visitId: [firstVisit, Validators.required], name: ['', Validators.required], date: [today(), Validators.required], laboratoryName: [''], status: ['NORMAL'], interpretation: [''], params: new FormArray([]) },
    };
    return this.fb.group(groups[this.data.kind] as never) as unknown as FormGroup;
  }

  protected addParam(): void {
    this.params.push(this.fb.group({ parameter: [''], result: [''], unit: [''], reference: [''], flag: ['NORMAL'] }));
  }

  protected removeParam(i: number): void {
    this.params.removeAt(i);
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue() as Record<string, string | number>;
    const str = (k: string): string | undefined => (String(v[k] ?? '').trim() ? String(v[k]).trim() : undefined);
    const nr = (k: string): number | undefined => (String(v[k] ?? '').trim() === '' ? undefined : Number(v[k]));
    const petId = this.data.petId;
    const who = this.session.user()?.fullName ?? '';

    let call: Observable<unknown>;
    switch (this.data.kind) {
      case 'weight':
        call = this.api.addWeight({ petId, weight: Number(v['weight']), unit: v['unit'] as 'kg' | 'g' | 'lb', date: String(v['date']), note: str('note') });
        break;
      case 'vaccine':
        call = this.api.applyVaccine({
          petId,
          name: String(v['name']).trim(),
          applicationDate: String(v['applicationDate']),
          nextDoseDate: str('nextDoseDate'),
          lotNumber: str('lotNumber'),
          manufacturer: str('manufacturer'),
          veterinarian: who || undefined,
          notes: str('notes'),
        });
        break;
      case 'treatment':
        call = this.api.createTreatment({
          visitId: String(v['visitId']),
          description: String(v['description']).trim(),
          startDate: String(v['startDate']),
          endDate: str('endDate'),
          protocol: str('protocol'),
          instructions: str('instructions'),
          status: 'ACTIVO',
        });
        break;
      case 'medication':
        call = this.api.addMedication(this.data.targetId!, {
          name: String(v['name']).trim(),
          dosage: String(v['dosage']).trim(),
          frequency: String(v['frequency']).trim(),
          duration: String(v['duration']).trim(),
          startDate: today(),
          status: 'ACTIVO',
        });
        break;
      case 'surgery':
        call = this.api.createSurgery({
          petId,
          veterinaryVisitId: String(v['veterinaryVisitId']),
          title: String(v['title']).trim(),
          surgeryDate: String(v['surgeryDate']),
          description: str('description'),
          durationMinutes: nr('durationMinutes'),
          anesthesiaUsed: str('anesthesiaUsed'),
          postOpInstructions: str('postOpInstructions'),
          asaRisk: nr('asaRisk'),
          veterinarian: who || undefined,
        });
        break;
      case 'surgeryStatus':
        call = this.api.updateSurgeryStatus(this.data.targetId!, { status: String(v['status']), outcome: str('outcome') });
        break;
      case 'lab': {
        const rows = (this.params.getRawValue() as { parameter: string; result: string; unit: string; reference: string; flag: string }[]).filter((p) => p.parameter.trim() && p.result.trim());
        call = this.api.createLab({
          visitId: String(v['visitId']),
          name: String(v['name']).trim(),
          date: String(v['date']),
          veterinarian: who || undefined,
          laboratoryName: str('laboratoryName'),
          status: String(v['status']),
          interpretation: str('interpretation'),
          results: rows,
        });
        break;
      }
      default:
        call = this.api.createVisit({
          petId,
          reason: String(v['reason']).trim(),
          date: String(v['date']),
          veterinarian: who,
          weight: nr('weight'),
          temperature: nr('temperature'),
          heartRate: nr('heartRate'),
          respiratoryRate: nr('respiratoryRate'),
          anamnesis: str('anamnesis'),
          physicalExam: str('physicalExam'),
          diagnosis: str('diagnosis'),
          plan: str('plan'),
          appointmentId: null,
        });
    }

    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => this.ref.close(true),
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(errorMessage(e, 'No pudimos guardar. Inténtalo de nuevo.'));
      },
    });
  }
}
