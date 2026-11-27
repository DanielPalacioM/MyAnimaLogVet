import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VET_API } from '@auth/auth.config';
import { ScheduleApi } from './schedule.api';
import { CatalogApi } from './catalog.api';
import { serviceFrom, serviceRoleToApi } from './mappers';

// Forma de las carpetas 15, 16 y 17 de "MyAnimaLog · Veterinary Service" (colección de 92 endpoints).
describe('Veterinary · catálogo y horarios (Fase 5)', () => {
  let schedule: ScheduleApi;
  let catalog: CatalogApi;
  let http: HttpTestingController;
  const V = 'v1';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    schedule = TestBed.inject(ScheduleApi);
    catalog = TestBed.inject(CatalogApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lee el horario de la clínica desde `items` y lo guarda como arreglo simple', () => {
    let rows: any[] = [];
    schedule.businessHours(V).subscribe((r) => (rows = r));
    http.expectOne(`${VET_API}/${V}/business-hours`).flush({ timezone: 'America/Bogota', items: [{ dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' }] });
    expect(rows.length).toBe(1);

    schedule.replaceBusinessHours(V, [{ dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' }]).subscribe();
    const put = http.expectOne(`${VET_API}/${V}/business-hours`);
    expect(put.request.method).toBe('PUT');
    expect(Array.isArray(put.request.body)).toBeTrue();
    put.flush({ items: [] });
  });

  it('horario de un empleado: sin filas usa el de la clínica; [] lo devuelve a ese horario', () => {
    let res: any;
    schedule.employeeSchedule(V, 'e1').subscribe((r) => (res = r));
    http.expectOne(`${VET_API}/${V}/employees/e1/schedule`).flush({ employeeId: 'e1', timezone: 'America/Bogota', usesClinicHours: true, items: [] });
    expect(res.usesClinicHours).toBeTrue();

    schedule.replaceEmployeeSchedule(V, 'e1', []).subscribe();
    const put = http.expectOne(`${VET_API}/${V}/employees/e1/schedule`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual([]);
    put.flush({});
  });

  it('el catálogo llega en `items` y quién lo presta va por roles', () => {
    let list: any[] = [];
    catalog.list(V).subscribe((r) => (list = r));
    http.expectOne(`${VET_API}/${V}/services`).flush({
      items: [{ id: 's1', name: 'Consulta general', category: 'CONSULTATION', durationMinutes: 30, price: 40000, bookableOnline: true, active: true, requiresLicense: true, allowedRoles: ['OWNER', 'VETERINARIAN'] }],
    });
    const s = serviceFrom(list[0]);
    expect(s.allowedRoles).toEqual(['OWNER', 'VET']);
    expect(s.requiresLicense).toBeTrue();
    expect(['OWNER', 'VET', 'RECEPTION'].map((r) => serviceRoleToApi(r as any))).toEqual(['OWNER', 'VETERINARIAN', 'RECEPTIONIST']);
  });
});
