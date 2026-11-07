import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { AdminState } from '@services/admin/admin.state';
import { errorMessage } from '@services/api-error';
import { AdminApi, RequestStatus, VerificationDetail, VerificationItem, VerificationQueue } from '@services/api/admin.api';
import {
  aiChip,
  Chip,
  DOCUMENT_LABELS,
  formatDay,
  formatNitFull,
  formatNumber,
  PROFESSION_LABELS,
  requestStatusChip,
} from '../admin.format';
import { CorrectionDialog, CorrectionData } from '../dialogs/correction.dialog';
import { CompareRow, DocumentViewerDialog, ViewerData } from '../dialogs/document-viewer.dialog';
import { RejectData, RejectDialog } from '../dialogs/reject.dialog';

const MODAL: MatDialogConfig = { panelClass: 'vet-dialog', backdropClass: 'vet-backdrop', autoFocus: 'first-tabbable', maxWidth: '96vw' };

interface Field {
  label: string;
  value: string;
}

interface DocRow {
  id: string;
  title: string;
  sub: string;
}

interface AiView {
  chip: Chip;
  checks: { ok: boolean; text: string }[];
}

/** Container: "Verificaciones" (Figma 2040:300). Cola de solicitudes a la izquierda y el detalle para decidir a la derecha. */
@Component({
  selector: 'vet-admin-verifications-page',
  standalone: false,
  templateUrl: './verifications.page.html',
  styleUrl: './verifications.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly state = inject(AdminState);

  protected readonly filters: readonly { value: RequestStatus; label: string; counted: boolean }[] = [
    { value: 'UNDER_REVIEW', label: 'En revisión', counted: true },
    { value: 'NEEDS_CORRECTION', label: 'Corrección pedida', counted: true },
    { value: 'APPROVED', label: 'Aprobadas', counted: false },
    { value: 'REJECTED', label: 'Rechazadas', counted: false },
    { value: 'DRAFT', label: 'Sin enviar', counted: false },
  ];

  protected readonly filter = signal<RequestStatus>('UNDER_REVIEW');
  protected readonly queue = signal<VerificationQueue | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly detail = signal<VerificationDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  protected readonly checked = signal(false);
  protected readonly deciding = signal(false);
  protected readonly rerunning = signal(false);

  protected readonly items = computed(() => this.queue()?.items ?? []);
  protected readonly selected = computed(() => this.items().find((i) => i.requestId === this.selectedId()) ?? null);
  protected readonly isClinic = computed(() => this.detail()?.subjectType === 'CLINIC');
  protected readonly canDecide = computed(() => this.detail()?.status === 'UNDER_REVIEW');

  protected readonly view = computed(() => {
    const d = this.detail();
    const item = this.selected();
    if (!d) return null;
    const clinic = d.subjectType === 'CLINIC';
    const text = (key: string): string => (d.declared[key] == null ? '' : String(d.declared[key]));
    const status = requestStatusChip(d.status);
    const attempt = `${d.attemptNumber} de 3`;
    const account = d.account.email ? `${d.account.email} (verificado)` : '—';
    const left: Field[] = [];
    const right: Field[] = [];
    const add = (list: Field[], label: string, value: string) => value && list.push({ label, value });

    if (clinic) {
      add(left, 'NIT', formatNitFull(text('nit')));
      add(left, 'Razón social', text('legalName'));
      add(left, 'Ciudad', [text('city'), text('department')].filter(Boolean).join(', '));
      add(right, 'Representante', [text('legalRepName'), text('legalRepDocumentType') && `${text('legalRepDocumentType')} ${formatNumber(text('legalRepDocumentNumber'))}`].filter(Boolean).join(' · '));
      add(right, 'Dueña de la cuenta', account);
    } else {
      add(left, 'Profesión', PROFESSION_LABELS[text('profession')] ?? text('profession'));
      add(left, 'Tarjeta profesional', text('licenseNumber'));
      add(left, 'Universidad', text('university'));
      add(left, 'Trabaja en', text('workplaces'));
      add(right, 'Documento', text('documentType') && `${text('documentType')} ${formatNumber(text('documentNumber'))}`);
      add(right, 'Correo de la cuenta', account);
      add(right, 'Especialidad', text('specialty'));
    }
    right.push({ label: 'Intento', value: attempt });

    const docs: DocRow[] = d.documents.map((doc) => ({
      id: doc.documentId,
      title: DOCUMENT_LABELS[doc.documentType] ?? doc.documentType,
      sub: [doc.fileName, doc.fileSizeBytes ? sizeLabel(doc.fileSizeBytes) : ''].filter(Boolean).join(' · '),
    }));

    const ai: AiView = {
      chip: { ...aiChip(d.ai.riskLevel), label: aiChip(d.ai.riskLevel).label.replace('IA: riesgo', 'Riesgo').replace('IA: no corrió', 'No corrió') },
      checks: (d.ai.report?.checks ?? []).map((c) =>
        typeof c === 'string' ? { ok: true, text: c } : { ok: c.ok !== false, text: c.text ?? c.label ?? '' },
      ),
    };

    return {
      title: clinic ? text('name') || item?.subjectName || '' : text('fullName') || item?.subjectName || '',
      status,
      left,
      right,
      docs,
      ai,
      who: clinic ? 'La clínica' : 'El veterinario',
      noteWho: clinic ? 'la clínica' : 'el veterinario',
      checkText: clinic
        ? 'Confirmé los datos en el registro oficial (RUES para la clínica; COMVEZCOL para las tarjetas profesionales). Obligatorio para aprobar.'
        : 'Confirmé la tarjeta en el registro oficial de COMVEZCOL (número, nombre y vigencia). Obligatorio para aprobar.',
      approveLabel: clinic ? 'Aprobar e iniciar prueba PRO' : 'Aprobar y verificar tarjeta',
      footNote: clinic
        ? 'Rechazar y pedir corrección piden un motivo, que la clínica sí ve. Al aprobar queda guardado quién aprobó y cuándo.'
        : 'Rechazar y pedir corrección piden un motivo, que el veterinario sí ve. Al aprobar queda guardado quién aprobó y cuándo; podrá registrar visitas clínicas en todas sus clínicas.',
      duplicates: d.duplicates,
    };
  });

  ngOnInit(): void {
    this.loadQueue();
  }

  // ---- Cola ----

  protected setFilter(value: RequestStatus): void {
    if (this.filter() === value) return;
    this.filter.set(value);
    this.selectedId.set(null);
    this.detail.set(null);
    this.loadQueue();
  }

  protected count(value: RequestStatus): number {
    const counted = this.queue()?.counts?.[value];
    // Sin conteo del backend, la pestaña abierta cuenta su propia lista.
    return counted ?? (this.filter() === value ? (this.queue()?.items.length ?? 0) : 0);
  }

  protected chip(item: VerificationItem): Chip {
    return aiChip(item.aiRiskLevel);
  }

  protected kind(item: VerificationItem): string {
    const who = item.subjectType === 'CLINIC' ? 'Clínica' : `Profesional${item.profession ? ' · ' + item.profession : ''}`;
    return `${who} · Enviada el ${formatDay(item.submittedAt)}`;
  }

  protected loadQueue(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.queue(this.filter()).subscribe({
      next: (queue) => {
        this.queue.set(queue);
        this.loading.set(false);
        this.focusRequested(queue);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e, 'No pudimos cargar la cola de verificaciones.'));
        this.loading.set(false);
      },
    });
  }

  /** Llega de "Revisar" en Clínicas (`?clinica=<id>`): abre esa solicitud; si no está en esta pestaña, prueba "Corrección pedida". */
  private requestedSubject = this.route.snapshot.queryParamMap.get('clinica');

  private focusRequested(queue: VerificationQueue): void {
    const wanted = this.requestedSubject;
    if (wanted) {
      const hit = queue.items.find((i) => i.subjectId === wanted);
      if (hit) {
        this.requestedSubject = null;
        return this.select(hit.requestId);
      }
      if (this.filter() === 'UNDER_REVIEW') {
        this.filter.set('NEEDS_CORRECTION');
        return this.loadQueue();
      }
      this.requestedSubject = null;
    }
    const keep = queue.items.find((i) => i.requestId === this.selectedId());
    const target = keep ?? queue.items[0];
    if (target) this.select(target.requestId, !!keep);
    else {
      this.selectedId.set(null);
      this.detail.set(null);
    }
  }

  // ---- Detalle ----

  protected select(requestId: string, keepChecked = false): void {
    this.selectedId.set(requestId);
    if (!keepChecked) this.checked.set(false);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.api.detail(requestId).subscribe({
      next: (detail) => {
        if (this.selectedId() !== requestId) return;
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: (e: unknown) => {
        this.detailError.set(errorMessage(e, 'No pudimos abrir la solicitud.'));
        this.detail.set(null);
        this.detailLoading.set(false);
      },
    });
  }

  protected openDocument(index: number): void {
    const d = this.detail();
    if (!d) return;
    const v = this.view();
    const data: ViewerData = {
      requestId: d.requestId,
      name: v?.title ?? '',
      documents: d.documents,
      index,
      compare: compareRows(d),
    };
    // El foco va al diálogo (no al PDF) para que Escape lo cierre.
    this.dialog.open(DocumentViewerDialog, { ...MODAL, autoFocus: 'dialog', data });
  }

  protected rerunAi(): void {
    const d = this.detail();
    if (!d || this.rerunning()) return;
    this.rerunning.set(true);
    this.api.rerunAi(d.requestId).subscribe({
      next: () => {
        this.rerunning.set(false);
        this.snack.open('Volvimos a analizar los documentos.', 'Cerrar', { duration: 3500 });
        this.select(d.requestId, true);
      },
      error: (e: unknown) => {
        this.rerunning.set(false);
        this.snack.open(errorMessage(e), 'Cerrar', { duration: 4500 });
      },
    });
  }

  // ---- Decisión ----

  protected approve(): void {
    const d = this.detail();
    if (!d || !this.checked() || this.deciding()) return;
    this.deciding.set(true);
    this.api.approve(d.requestId).subscribe({
      next: () => {
        this.deciding.set(false);
        this.snack.open(d.subjectType === 'CLINIC' ? 'Clínica aprobada. Empieza su prueba PRO.' : 'Tarjeta verificada.', 'Cerrar', { duration: 4000 });
        this.afterDecision();
      },
      error: (e: unknown) => {
        this.deciding.set(false);
        this.snack.open(errorMessage(e), 'Cerrar', { duration: 5000 });
      },
    });
  }

  protected reject(): void {
    const d = this.detail();
    if (!d) return;
    const data: RejectData = { requestId: d.requestId, subjectType: d.subjectType, name: this.view()?.title ?? '', attempt: d.attemptNumber };
    this.dialog.open<RejectDialog, RejectData, boolean>(RejectDialog, { ...MODAL, data }).afterClosed().subscribe((done) => done && this.afterDecision());
  }

  protected requestCorrection(): void {
    const d = this.detail();
    if (!d) return;
    const data: CorrectionData = { requestId: d.requestId, subjectType: d.subjectType, name: this.view()?.title ?? '' };
    this.dialog.open<CorrectionDialog, CorrectionData, boolean>(CorrectionDialog, { ...MODAL, data }).afterClosed().subscribe((done) => done && this.afterDecision());
  }

  /** La solicitud decidida sale de esta pestaña: se vuelve a cargar la cola y se abre la siguiente. */
  private afterDecision(): void {
    this.selectedId.set(null);
    this.detail.set(null);
    this.checked.set(false);
    this.state.refresh();
    this.loadQueue();
  }
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Lo que el solicitante declaró, agrupado por el documento con el que se compara. */
function compareRows(d: VerificationDetail): Record<string, CompareRow[]> {
  const v = (key: string): string => (d.declared[key] == null ? '' : String(d.declared[key]));
  const rows = (...list: [string, string][]): CompareRow[] => list.filter(([, value]) => value).map(([label, value]) => ({ label, value }));
  const idNumber = v('legalRepDocumentType') ? `${v('legalRepDocumentType')} ${formatNumber(v('legalRepDocumentNumber'))}` : '';
  if (d.subjectType === 'CLINIC') {
    return {
      RUT: rows(['NIT declarado', formatNitFull(v('nit'))], ['Razón social declarada', v('legalName')]),
      CHAMBER_OF_COMMERCE: rows(['Razón social declarada', v('legalName')], ['Representante legal declarado', v('legalRepName')]),
      LEGAL_REP_ID: rows(['Nombre declarado', v('legalRepName')], ['Documento declarado', idNumber]),
      FACADE_PHOTO: rows(['Dirección declarada', v('address')], ['Ciudad', v('city')]),
    };
  }
  const id = v('documentType') ? `${v('documentType')} ${formatNumber(v('documentNumber'))}` : '';
  return {
    PROFESSIONAL_CARD: rows(['Nombre declarado', v('fullName')], ['Número de tarjeta', v('licenseNumber')], ['Profesión', PROFESSION_LABELS[v('profession')] ?? v('profession')]),
    ID_DOCUMENT: rows(['Nombre declarado', v('fullName')], ['Documento declarado', id]),
    DEGREE: rows(['Nombre declarado', v('fullName')], ['Universidad', v('university')]),
  };
}
