import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { USER_API } from '@auth/auth.config';
import { MedicalApi } from './medical.api';

const MED = { id: 'm1', treatmentId: 't1', name: 'Amoxicilina', dosage: '15 mg', frequency: 'cada 8 h', duration: '3 dias', status: 'ACTIVO' };

describe('MedicalApi · medicamentos de un tratamiento', () => {
  let api: MedicalApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MedicalApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('usa los medicamentos que trae el listado de la visita, sin pedir más', () => {
    let out: any[] = [];
    api.treatmentsByVisit('v1').subscribe((r) => (out = r));
    http.expectOne(`${USER_API}/visits/v1/treatment`).flush([{ id: 't1', description: 'Otitis', status: 'ACTIVO', medications: [MED] }]);
    expect(out[0].medications.map((m: any) => m.name)).toEqual(['Amoxicilina']);
  });

  it('si el listado no trae los medicamentos, los completa con GET /treatments/{id}', () => {
    let out: any[] = [];
    api.treatmentsByVisit('v1').subscribe((r) => (out = r));
    http.expectOne(`${USER_API}/visits/v1/treatment`).flush({ data: [{ id: 't1', description: 'Otitis', status: 'ACTIVO' }] });
    http.expectOne(`${USER_API}/treatments/t1`).flush({ success: true, data: { id: 't1', description: 'Otitis', status: 'ACTIVO', medications: [MED] } });
    expect(out[0].description).toBe('Otitis');
    expect(out[0].medications[0].dosage).toBe('15 mg');
  });

  it('acepta otros nombres del campo y, si el detalle falla, deja el tratamiento sin medicamentos', () => {
    let out: any[] = [];
    api.treatmentsByVisit('v1').subscribe((r) => (out = r));
    http.expectOne(`${USER_API}/visits/v1/treatment`).flush([{ id: 't1', description: 'A' }, { id: 't2', description: 'B', treatmentMedications: [MED] }]);
    http.expectOne(`${USER_API}/treatments/t1`).flush({}, { status: 500, statusText: 'Server Error' });
    expect(out.map((t) => t.medications.length)).toEqual([0, 1]);
  });
});
