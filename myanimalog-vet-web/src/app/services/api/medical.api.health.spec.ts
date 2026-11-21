import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { USER_API } from '@auth/auth.config';
import { MedicalApi } from './medical.api';

// Rutas y respuestas de las carpetas D9 y V10 de la colección "Medical Pet Backend · Dueño y Veterinaria".
describe('MedicalApi · alergias, esterilización y desparasitación', () => {
  let api: MedicalApi;
  let http: HttpTestingController;
  const PET = 'pet-1';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MedicalApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista las alergias con su estado general', () => {
    let out: any;
    api.allergies(PET).subscribe((r) => (out = r));
    const req = http.expectOne((r) => r.url === `${USER_API}/allergies`);
    expect(req.request.params.get('petId')).toBe(PET);
    req.flush({ allergyStatus: 'HAS_ALLERGIES', allergies: [{ id: 'a1', allergen: 'Penicilina', category: 'DRUG', severity: 'SEVERE', status: 'SUSPECTED', source: 'OWNER' }] });
    expect(out.status).toBe('HAS_ALLERGIES');
    expect(out.items[0].allergen).toBe('Penicilina');
    expect(out.items[0].state).toBe('SUSPECTED');
  });

  it('"No sé" no es "no tiene": sin estado ni alergias queda sin preguntar', () => {
    let out: any;
    api.allergies(PET).subscribe((r) => (out = r));
    http.expectOne((r) => r.url === `${USER_API}/allergies`).flush({ allergies: [] });
    expect(out.status).toBe('UNKNOWN');
  });

  it('la clínica registra una alergia y confirma la del dueño con motivo', () => {
    api.addAllergy({ petId: PET, allergen: 'Pollo', category: 'FOOD', severity: 'MILD' }).subscribe();
    const post = http.expectOne(`${USER_API}/allergies`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ petId: PET, allergen: 'Pollo', category: 'FOOD', severity: 'MILD' });
    post.flush({ id: 'x', status: 'CONFIRMED' });

    api.confirmAllergy('a1', 'Confirmada en consulta').subscribe();
    const conf = http.expectOne(`${USER_API}/allergies/a1/confirm`);
    expect(conf.request.method).toBe('POST');
    expect(conf.request.body).toEqual({ reason: 'Confirmada en consulta' });
    conf.flush({ version: 2 });
  });

  it('confirma la esterilización: la fecha viaja solo con "Sí" y vuelve con la confirmación de la clínica', () => {
    let out: any;
    api.setNeutered(PET, 'YES', '2024-03-01').subscribe((r) => (out = r));
    const req = http.expectOne(`${USER_API}/pets/${PET}/clinical-profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ neuteredStatus: 'YES', neuteredAt: '2024-03-01' });
    req.flush({ neutered: { status: 'YES', at: '2024-03-01', source: 'CLINIC', confirmedByEmployeeId: 'emp-1' } });
    expect(out.confirmed).toBeTrue();

    api.setNeutered(PET, 'NO', '2024-03-01').subscribe();
    const no = http.expectOne(`${USER_API}/pets/${PET}/clinical-profile`);
    expect(no.request.body).toEqual({ neuteredStatus: 'NO' });
    no.flush({ neutered: { status: 'NO' } });
  });

  it('el resumen trae esterilización y deja fuera las alergias resueltas', () => {
    let out: any;
    api.clinicalSummary(PET).subscribe((r) => (out = r));
    http.expectOne(`${USER_API}/pets/${PET}/clinical-summary`).flush({
      data: { allergies: [{ allergen: 'Penicilina', status: 'CONFIRMED' }, { allergen: 'Polen', status: 'RESOLVED' }], neutered: { status: 'YES', source: 'OWNER' }, prevention: {} },
    });
    expect(out.allergies).toEqual(['Penicilina']);
    expect(out.neutered.status).toBe('YES');
    expect(out.neutered.confirmed).toBeFalse();
  });

  it('desparasitación: última dosis por tipo y registro con origen clínica', () => {
    let out: any;
    api.dewormings(PET).subscribe((r) => (out = r));
    const get = http.expectOne((r) => r.url === `${USER_API}/dewormings`);
    expect(get.request.params.get('petId')).toBe(PET);
    get.flush({ dewormings: { INTERNAL: { registered: true, lastApplicationDate: '2026-10-01' }, EXTERNAL: { registered: false, lastApplicationDate: null } } });
    expect(out.INTERNAL.registered).toBeTrue();
    expect(out.INTERNAL.lastApplicationDate).toBe('2026-10-01');
    expect(out.EXTERNAL.registered).toBeFalse();
    expect(out.history).toEqual([]);

    const body = { petId: PET, kind: 'EXTERNAL' as const, product: 'Frontline', applicationDate: '2026-10-01' };
    api.addDeworming(body).subscribe();
    const post = http.expectOne(`${USER_API}/dewormings`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(body);
    post.flush({ id: 'd1' });
  });

  it('con una lista de dosis arma el historial sin las anuladas', () => {
    let out: any;
    api.dewormings(PET).subscribe((r) => (out = r));
    http.expectOne((r) => r.url === `${USER_API}/dewormings`).flush([
      { id: 'a', kind: 'INTERNAL', product: 'Drontal', applicationDate: '2026-08-01' },
      { id: 'b', kind: 'INTERNAL', product: 'X', applicationDate: '2026-09-01', status: 'ENTERED_IN_ERROR' },
    ]);
    expect(out.history.length).toBe(1);
    expect(out.INTERNAL.product).toBe('Drontal');
  });

  it('un tratamiento se corrige con /corrections y motivo (el PUT ya no existe)', () => {
    api.updateTreatment('t1', { status: 'SUSPENDIDO', suspensionReason: 'Reacción' }, 'Por reacción').subscribe();
    const req = http.expectOne(`${USER_API}/treatments/t1/corrections`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ status: 'SUSPENDIDO', suspensionReason: 'Reacción', reason: 'Por reacción' });
    req.flush({});
  });
});
