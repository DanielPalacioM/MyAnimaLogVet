import { AiRisk, RejectReason, RequestStatus, SubjectType } from '@services/api/admin.api';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-10-12T09:30:00" → "12 oct" */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "2026-03-03T…" → "3 mar 2026" ("—" si no hay fecha). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "900123456-7" → "900.123.456-7" */
export function formatNitFull(nit: string | number | null | undefined): string {
  const [body, dv] = String(nit ?? '').split('-');
  if (!body) return '—';
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dv ? `${grouped}-${dv}` : grouped;
}

/** "45678901" → "45.678.901" */
export function formatNumber(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const DOCUMENT_LABELS: Record<string, string> = {
  RUT: 'RUT',
  CHAMBER_OF_COMMERCE: 'Cámara de Comercio',
  LEGAL_REP_ID: 'Cédula del representante',
  FACADE_PHOTO: 'Foto de la fachada (opcional)',
  PROFESSIONAL_CARD: 'Tarjeta profesional',
  ID_DOCUMENT: 'Cédula',
  DEGREE: 'Diploma (opcional)',
};

/** Documentos que el revisor puede pedir corregir, por tipo de solicitud. */
export const CORRECTABLE: Record<SubjectType, readonly string[]> = {
  CLINIC: ['RUT', 'CHAMBER_OF_COMMERCE', 'LEGAL_REP_ID', 'FACADE_PHOTO'],
  PROFESSIONAL: ['PROFESSIONAL_CARD', 'ID_DOCUMENT', 'DEGREE'],
};

export const PROFESSION_LABELS: Record<string, string> = {
  MV: 'Médico veterinario (MV)',
  MVZ: 'Médico veterinario zootecnista (MVZ)',
};

export const REJECT_REASONS: Record<SubjectType, readonly { value: RejectReason; label: string }[]> = {
  PROFESSIONAL: [
    { value: 'NOT_IN_REGISTRY', label: 'La tarjeta no aparece en COMVEZCOL' },
    { value: 'DATA_MISMATCH', label: 'Los datos no coinciden con la cédula' },
    { value: 'DOCUMENT_INVALID', label: 'Documento ilegible, alterado o vencido' },
    { value: 'OTHER', label: 'Otro motivo' },
  ],
  CLINIC: [
    { value: 'NOT_IN_REGISTRY', label: 'La clínica no aparece en el RUES' },
    { value: 'DATA_MISMATCH', label: 'Los datos no coinciden con los documentos' },
    { value: 'DOCUMENT_INVALID', label: 'Documento ilegible, alterado o vencido' },
    { value: 'OTHER', label: 'Otro motivo' },
  ],
};

export interface Chip {
  label: string;
  /** Clase de color: `ok`, `warn`, `bad`, `mute`, `soft`. */
  tone: 'ok' | 'warn' | 'bad' | 'mute' | 'soft';
}

/** Chip de la cola: "IA: riesgo bajo / medio / alto" o "IA: no corrió". */
export function aiChip(risk: AiRisk | null): Chip {
  switch (risk) {
    case 'LOW':
      return { label: 'IA: riesgo bajo', tone: 'ok' };
    case 'MEDIUM':
      return { label: 'IA: riesgo medio', tone: 'warn' };
    case 'HIGH':
      return { label: 'IA: riesgo alto', tone: 'bad' };
    default:
      return { label: 'IA: no corrió', tone: 'mute' };
  }
}

export function requestStatusChip(status: RequestStatus): Chip {
  switch (status) {
    case 'DRAFT':
      return { label: 'Sin enviar', tone: 'mute' };
    case 'UNDER_REVIEW':
      return { label: 'En revisión', tone: 'warn' };
    case 'NEEDS_CORRECTION':
      return { label: 'Corrección pedida', tone: 'soft' };
    case 'APPROVED':
      return { label: 'Aprobada', tone: 'ok' };
    case 'REJECTED':
      return { label: 'Rechazada', tone: 'bad' };
  }
}

export function clinicStatusChip(status: string): Chip {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Activa', tone: 'ok' };
    case 'SUSPENDED':
      return { label: 'Suspendida', tone: 'mute' };
    case 'UNDER_REVIEW':
      return { label: 'En revisión', tone: 'warn' };
    case 'NEEDS_CORRECTION':
      return { label: 'Corrección pedida', tone: 'soft' };
    case 'REJECTED':
      return { label: 'Rechazada', tone: 'bad' };
    default:
      return { label: 'Sin documentos', tone: 'mute' };
  }
}

/** Estado de la tarjeta profesional (de la persona, no del empleo). */
export function licenseChip(status: string): Chip {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Verificada', tone: 'ok' };
    case 'PENDING':
      return { label: 'En revisión', tone: 'warn' };
    case 'REJECTED':
      return { label: 'Rechazada', tone: 'bad' };
    default:
      return { label: 'Sin enviar', tone: 'mute' };
  }
}

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return '—';
  return plan === 'PRO_TRIAL' ? 'PRO (prueba)' : plan;
}
