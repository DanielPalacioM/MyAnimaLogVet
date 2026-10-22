import { DocumentType } from './registration.model';

export interface DocumentSpec {
  title: string;
  hint: string;
  optional?: boolean;
}

/** Textos de las tarjetas de documento (Figma 1910:20 y 1910:131). */
export const DOCUMENT_SPECS: Record<DocumentType, DocumentSpec> = {
  RUT: { title: 'RUT', hint: 'PDF de la DIAN con la actividad veterinaria' },
  CHAMBER_OF_COMMERCE: { title: 'Certificado de Cámara de Comercio', hint: 'Expedido hace menos de 30 días' },
  LEGAL_REP_ID: { title: 'Cédula del representante legal', hint: 'Ambas caras, legible y sin recortes' },
  FACADE_PHOTO: {
    title: 'Foto de la fachada (opcional)',
    hint: 'Ayuda a que la revisión sea más rápida',
    optional: true,
  },
  PROFESSIONAL_CARD: { title: 'Tarjeta profesional', hint: 'Foto o PDF, ambas caras' },
  ID_DOCUMENT: { title: 'Tu cédula', hint: 'Ambas caras, legible y sin recortes' },
  DEGREE: { title: 'Título profesional (opcional)', hint: 'Diploma o acta de grado', optional: true },
};

/** Documentos de la clínica, en el orden del paso 4. */
export const CLINIC_DOCUMENTS: readonly DocumentType[] = [
  'RUT',
  'CHAMBER_OF_COMMERCE',
  'LEGAL_REP_ID',
  'FACADE_PHOTO',
];

export const REQUIRED_CLINIC_DOCUMENTS: readonly DocumentType[] = ['RUT', 'CHAMBER_OF_COMMERCE', 'LEGAL_REP_ID'];
