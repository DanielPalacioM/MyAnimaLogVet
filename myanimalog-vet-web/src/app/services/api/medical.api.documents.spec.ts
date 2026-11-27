import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { USER_API } from '@auth/auth.config';
import { MedicalApi } from './medical.api';

// Carpeta V8 "Documentos (solo veterinaria)" de la colección de Medical.
describe('MedicalApi · documentos de la mascota', () => {
  let api: MedicalApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MedicalApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sube en multipart con file, petId, documentType, title y visitId', () => {
    const file = new File(['%PDF'], 'quimica.pdf', { type: 'application/pdf' });
    let out: any;
    api.uploadDocument({ petId: 'p1', file, documentType: 'LABORATORIO', title: 'Química sanguínea', visitId: 'v1' }).subscribe((d) => (out = d));
    const req = http.expectOne(`${USER_API}/documents`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('petId')).toBe('p1');
    expect(body.get('documentType')).toBe('LABORATORIO');
    expect(body.get('title')).toBe('Química sanguínea');
    expect(body.get('visitId')).toBe('v1');
    expect((body.get('file') as File).name).toBe('quimica.pdf');
    req.flush({ success: true, data: { id: 'd1', petId: 'p1', documentType: 'LABORATORIO', title: 'Química sanguínea' } });
    expect(out.id).toBe('d1');
  });

  it('lista por mascota (los más nuevos primero) y abre con la URL firmada del detalle', () => {
    let list: any[] = [];
    api.documents('p1').subscribe((r) => (list = r));
    const req = http.expectOne((r) => r.url === `${USER_API}/documents`);
    expect(req.request.params.get('petId')).toBe('p1');
    req.flush({ data: [{ id: 'a', title: 'Viejo', createdAt: '2026-10-01T10:00:00' }, { id: 'b', title: 'Nuevo', createdAt: '2026-11-20T10:00:00' }] });
    expect(list.map((d) => d.id)).toEqual(['b', 'a']);

    let one: any;
    api.document('b').subscribe((d) => (one = d));
    http.expectOne(`${USER_API}/documents/b`).flush({ data: { id: 'b', signedUrl: 'https://storage/x?sig=1' } });
    expect(one.signedUrl).toContain('sig=1');

    api.deleteDocument('b').subscribe();
    expect(http.expectOne(`${USER_API}/documents/b`).request.method).toBe('DELETE');
  });
});
