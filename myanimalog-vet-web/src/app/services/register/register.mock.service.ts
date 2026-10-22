import { inject, Injectable } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { mockFailure, mockResponse } from '../mock/mock.config';
import { MockUserDirectory, normalizeEmail } from '../mock/mock-directory';
import { REQUIRED_CLINIC_DOCUMENTS } from './models/documents.model';
import {
  AccountInput,
  ClinicAvailability,
  ClinicAvailabilityQuery,
  RegistrationReceipt,
  RegistrationSubmission,
  VerificationStatus,
} from './models/registration.model';
import { RegisterService, VerificationSummary } from './register.service';

interface MockClinicRecord {
  veterinaryId: string;
  requestId: string;
  name: string;
  nit: string;
  email: string;
  ownerEmail: string;
  status: VerificationStatus;
  submittedAt: string;
}

const CLINICS_KEY = 'vet.mock.clinics';
const MAX_OPEN_CLINICS_PER_OWNER = 3;

/** Clínicas que ya "existen" en el mock, para probar la unicidad. */
const SEEDED_TAKEN = { names: ['clinica patitas', 'huellas veterinaria'], nits: ['900123456'], emails: ['clinica@patitas.co'] };

const comparable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

@Injectable()
export class RegisterMockService extends RegisterService {
  private readonly directory = inject(MockUserDirectory);

  createAccount({ fullName, email, password }: AccountInput): Observable<{ userId: string }> {
    return defer(() => {
      const key = normalizeEmail(email);
      if (this.directory.find(key)) {
        return mockFailure('EMAIL_TAKEN', 'Ya existe una cuenta con este correo. Inicia sesión para continuar.');
      }
      const userId = `u-${crypto.randomUUID()}`;
      this.directory.add({
        email: key,
        password,
        emailVerified: false,
        user: { userId, fullName: fullName.trim(), email: key, clinic: null },
      });
      return mockResponse({ userId });
    });
  }

  sendVerificationCode(): Observable<{ resendAfterSeconds: number }> {
    // Mock: no se envía nada. `verifyEmail` acepta cualquier código de 6 dígitos salvo 000000.
    return mockResponse({ resendAfterSeconds: 45 });
  }

  verifyEmail(email: string, code: string): Observable<void> {
    return defer(() => {
      if (!/^\d{6}$/.test(code) || code === '000000') {
        return mockFailure('INVALID_CODE', 'El código no es correcto. Revísalo o pide uno nuevo.');
      }
      this.directory.update(email, (a) => ({ ...a, emailVerified: true }));
      return mockResponse(undefined);
    });
  }

  checkClinicAvailability(query: ClinicAvailabilityQuery): Observable<ClinicAvailability> {
    return defer(() => mockResponse(this.availability(query)));
  }

  submitRegistration(submission: RegistrationSubmission): Observable<RegistrationReceipt> {
    return defer(() => {
      const { account, clinic, profile } = submission;
      const ownerEmail = normalizeEmail(account.email);
      const stored = this.directory.find(ownerEmail);

      if (!stored || !stored.emailVerified) {
        return mockFailure('EMAIL_NOT_VERIFIED', 'Verifica tu correo antes de registrar tu clínica.');
      }
      const missing = REQUIRED_CLINIC_DOCUMENTS.filter((t) => !submission.documents[t]);
      if (missing.length > 0 || (profile.isVeterinarian === 'yes' && !submission.documents.PROFESSIONAL_CARD)) {
        return mockFailure('DOCUMENTS_MISSING', 'Faltan documentos obligatorios. Revisa el paso de documentos.');
      }

      const records = this.records();
      const open = records.filter((r) => r.ownerEmail === ownerEmail && r.status !== 'REJECTED');
      if (open.length >= MAX_OPEN_CLINICS_PER_OWNER) {
        return mockFailure(
          'TOO_MANY_CLINICS',
          'Ya tienes 3 clínicas en proceso. Espera la respuesta de alguna antes de registrar otra.',
        );
      }
      const taken = this.availability({ name: clinic.name, nit: clinic.nit, email: clinic.email });
      if (taken.nameTaken || taken.nitTaken || taken.emailTaken) {
        return mockFailure('CLINIC_TAKEN', 'Ya existe una clínica con el mismo nombre, NIT o correo.');
      }

      const veterinaryId = `vet-${crypto.randomUUID()}`;
      const requestId = `req-${crypto.randomUUID()}`;
      const submittedAt = new Date().toISOString();
      const veterinaryName = clinic.name.trim();

      this.directory.update(ownerEmail, (a) => ({
        ...a,
        user: { ...a.user, clinic: { veterinaryId, veterinaryName, status: 'UNDER_REVIEW', requestId, submittedAt } },
      }));
      this.saveRecords([
        ...records,
        {
          veterinaryId,
          requestId,
          name: clinic.name,
          nit: clinic.nit,
          email: clinic.email,
          ownerEmail,
          status: 'UNDER_REVIEW',
          submittedAt,
        },
      ]);

      return mockResponse<RegistrationReceipt>(
        { requestId, veterinaryId, veterinaryName, userId: stored.user.userId, status: 'UNDER_REVIEW', submittedAt },
        900,
      );
    });
  }

  getVerification(requestId: string): Observable<VerificationSummary> {
    return defer(() => {
      const record = this.records().find((r) => r.requestId === requestId);
      if (record) return mockResponse({ requestId, status: record.status, submittedAt: record.submittedAt });
      // Solicitudes sembradas en el directorio (login con una clínica ya en revisión).
      return mockResponse({ requestId, status: 'UNDER_REVIEW' as VerificationStatus, submittedAt: new Date().toISOString() });
    });
  }

  private availability({ name, nit, email }: ClinicAvailabilityQuery): ClinicAvailability {
    const records = this.records().filter((r) => r.status !== 'REJECTED');
    return {
      nameTaken:
        SEEDED_TAKEN.names.includes(comparable(name)) || records.some((r) => comparable(r.name) === comparable(name)),
      nitTaken: SEEDED_TAKEN.nits.includes(nit) || records.some((r) => r.nit === nit),
      emailTaken:
        SEEDED_TAKEN.emails.includes(normalizeEmail(email)) ||
        records.some((r) => normalizeEmail(r.email) === normalizeEmail(email)),
    };
  }

  private records(): MockClinicRecord[] {
    try {
      const raw = localStorage.getItem(CLINICS_KEY);
      return raw ? (JSON.parse(raw) as MockClinicRecord[]) : [];
    } catch {
      return [];
    }
  }

  private saveRecords(records: MockClinicRecord[]): void {
    try {
      localStorage.setItem(CLINICS_KEY, JSON.stringify(records));
    } catch {
      /* sin storage */
    }
  }
}
