/** Paso del registro. `consent` y `verify` no cuentan en el indicador "PASO N DE 6". */
export type StepId =
  | 'consent'
  | 'account'
  | 'verify'
  | 'clinic'
  | 'representative'
  | 'documents'
  | 'profile'
  | 'review';

export interface StepInfo {
  id: StepId;
  /** Segmento de ruta bajo `/registro`. */
  path: string;
  /** 1–6 para los pasos numerados. */
  number?: number;
  /** Texto del indicador, en mayúsculas. */
  label?: string;
}

export const STEPS: readonly StepInfo[] = [
  { id: 'consent', path: 'antes-de-empezar' },
  { id: 'account', path: 'cuenta', number: 1, label: 'TU CUENTA' },
  { id: 'verify', path: 'verificar-correo' },
  { id: 'clinic', path: 'clinica', number: 2, label: 'DATOS DE LA CLÍNICA' },
  { id: 'representative', path: 'representante', number: 3, label: 'REPRESENTANTE LEGAL' },
  { id: 'documents', path: 'documentos', number: 4, label: 'DOCUMENTOS' },
  { id: 'profile', path: 'perfil', number: 5, label: 'PERFIL PROFESIONAL' },
  { id: 'review', path: 'revisar', number: 6, label: 'REVISAR Y ENVIAR' },
];

export const STATUS_PATH = 'estado';
export const TOTAL_STEPS = 6;

export function stepInfo(id: StepId): StepInfo {
  return STEPS.find((s) => s.id === id)!;
}

/** Tipos de documento del backend (REGISTRO §3). */
export type DocumentType =
  | 'RUT'
  | 'CHAMBER_OF_COMMERCE'
  | 'LEGAL_REP_ID'
  | 'FACADE_PHOTO'
  | 'PROFESSIONAL_CARD'
  | 'ID_DOCUMENT'
  | 'DEGREE';

export type IdDocumentType = 'CC' | 'CE' | 'PPT';
export type Profession = 'MV' | 'MVZ';
export type YesNo = 'yes' | 'no';

export interface ConsentData {
  dataPolicy: boolean;
  terms: boolean;
}

/** La contraseña nunca se guarda en el borrador: solo viaja al crear la cuenta. */
export interface AccountData {
  fullName: string;
  email: string;
}

export interface ClinicData {
  name: string;
  legalName: string;
  /** 9 dígitos, sin guion. */
  nit: string;
  nitDv: string;
  /** 10 dígitos, sin +57. */
  phone: string;
  email: string;
  department: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LegalRepData {
  isSelf: YesNo | null;
  fullName: string;
  documentType: IdDocumentType;
  /** Solo dígitos. */
  documentNumber: string;
}

export interface ProfileData {
  isVeterinarian: YesNo | null;
  profession: Profession | '';
  licenseNumber: string;
  specialty: string;
  university: string;
}

export interface RegistrationFlags {
  accountCreated: boolean;
  emailVerified: boolean;
}

export interface RegistrationDraft {
  consent: ConsentData;
  account: AccountData;
  clinic: ClinicData;
  legalRep: LegalRepData;
  profile: ProfileData;
  declaration: boolean;
  flags: RegistrationFlags;
  /** Pasos con formulario ya confirmados (clínica, representante, documentos, perfil). */
  completed: StepId[];
}

export type DraftSection = 'consent' | 'account' | 'clinic' | 'legalRep' | 'profile';

export function emptyDraft(): RegistrationDraft {
  return {
    consent: { dataPolicy: false, terms: false },
    account: { fullName: '', email: '' },
    clinic: {
      name: '',
      legalName: '',
      nit: '',
      nitDv: '',
      phone: '',
      email: '',
      department: '',
      city: '',
      address: '',
      latitude: null,
      longitude: null,
    },
    legalRep: { isSelf: null, fullName: '', documentType: 'CC', documentNumber: '' },
    profile: { isVeterinarian: null, profession: '', licenseNumber: '', specialty: '', university: '' },
    declaration: false,
    flags: { accountCreated: false, emailVerified: false },
    completed: [],
  };
}

// ---- Contratos con la API ----

export interface AccountInput {
  fullName: string;
  email: string;
  password: string;
}

export interface ClinicAvailabilityQuery {
  name: string;
  nit: string;
  email: string;
}

export interface ClinicAvailability {
  nameTaken: boolean;
  nitTaken: boolean;
  emailTaken: boolean;
}

/** Lo que se envía a verificación: datos + archivos. */
export interface RegistrationSubmission {
  account: AccountData;
  clinic: ClinicData;
  legalRep: LegalRepData;
  profile: ProfileData;
  logo: File | null;
  documents: Partial<Record<DocumentType, File>>;
}

export type VerificationStatus = 'UNDER_REVIEW' | 'NEEDS_CORRECTION' | 'ACTIVE' | 'REJECTED';

export interface RegistrationReceipt {
  requestId: string;
  veterinaryId: string;
  veterinaryName: string;
  userId: string;
  status: VerificationStatus;
  /** ISO 8601. */
  submittedAt: string;
}
