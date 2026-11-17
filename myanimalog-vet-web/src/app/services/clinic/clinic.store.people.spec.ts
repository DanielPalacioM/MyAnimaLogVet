import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClinicContextService } from '@auth/services/clinic-context.service';
import { SessionService } from '@auth/services/session.service';
import { VET_API } from '@auth/auth.config';
import { ageFrom, clientFrom, patientFrom, sexFrom, speciesFrom, withDetail } from '../api/mappers';
import { ClinicStore } from './clinic.store';

const VET = '9a1c2f3e-4b5d-6e7f-8a9b-0c1d2e3f4a5b';

// Respuestas de ejemplo de la carpeta 14 de la colección de Postman (Fase 4A).
const CLIENT = { userId: 'u1', name: 'Carlos Pérez', email: 'carlos@correo.com', linkedAt: '2026-10-01T09:00:00', sharedPetsCount: 2 };
const PET_MAX = { petId: 'p1', name: 'Max', species: 'DOG', breed: 'Criollo', photoUrl: null, ownerUserId: 'u1', grantedAt: '2026-11-08T14:10:00' };

describe('mappers de clientes y pacientes', () => {
  it('speciesFrom agrupa en Perro, Gato y Otro', () => {
    expect(speciesFrom('DOG')).toBe('Perro');
    expect(speciesFrom('cat')).toBe('Gato');
    expect(speciesFrom('Gato')).toBe('Gato');
    expect(speciesFrom('RABBIT')).toBe('Otro');
    expect(speciesFrom(null)).toBe('Otro');
  });

  it('ageFrom: meses, años y sin fecha', () => {
    const now = new Date(2026, 10, 17).getTime();
    expect(ageFrom('2026-06-10', now)).toBe('5 meses');
    expect(ageFrom('2021-05-10', now)).toBe('5 años');
    expect(ageFrom('2026-11-01', now)).toBe('Menos de 1 mes');
    expect(ageFrom(null, now)).toBe('—');
  });

  it('patientFrom deja lo que el backend aún no da como "sin registro"', () => {
    const p = patientFrom(PET_MAX, 'Carlos Pérez');
    expect(p).toEqual(jasmine.objectContaining({
      id: 'p1', name: 'Max', species: 'Perro', breed: 'Criollo', owner: 'Carlos Pérez', ownerId: 'u1',
      vaccines: 'NONE', lastVisit: 'Sin visitas', lastVisitAt: 0, inApp: true,
    }));
  });

  it('sexFrom y withDetail traducen el sexo y calculan la edad', () => {
    expect(sexFrom('MALE')).toBe('Macho');
    expect(sexFrom('female')).toBe('Hembra');
    expect(sexFrom(null)).toBeUndefined();
    const now = new Date(2026, 10, 17).getTime();
    const base = patientFrom({ ...PET_MAX, species: 'perro' }, 'Carlos');
    expect(base.species).toBe('Perro');
    const full = withDetail(base, { ...PET_MAX, sex: 'MALE', birthDate: '2015-04-02' }, now);
    expect(full.age).toBe('11 años');
    expect(full.sex).toBe('Macho');
    // Un detalle sin fecha no borra lo que ya había.
    expect(withDetail(full, { ...PET_MAX, birthDate: null, sex: null }, now).sex).toBe('Macho');
  });

  it('clientFrom usa el userId como id, iniciales y fecha en ms', () => {
    const c = clientFrom(CLIENT, []);
    expect(c.id).toBe('u1');
    expect(c.initials).toBe('CP');
    expect(c.linkedAt).toBe(new Date('2026-10-01T09:00:00').getTime());
    expect(clientFrom({ ...CLIENT, name: null }, []).name).toBe('carlos@correo.com');
    expect(clientFrom({ ...CLIENT, name: null, email: null }, []).name).toBe('Sin nombre');
  });
});

describe('ClinicStore · clientes y pacientes reales', () => {
  let store: ClinicStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: { clinic: () => ({ veterinaryId: VET }), patchClinic: () => undefined } },
        { provide: ClinicContextService, useValue: {} },
      ],
    });
    store = TestBed.inject(ClinicStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Responde clientes y pacientes y, como la app, el detalle de cada paciente (sexo, nacimiento). */
  const flushPeople = (clients: unknown[], patients: unknown[], detail: Record<string, unknown> = { sex: 'MALE', birthDate: '2015-04-02' }) => {
    http.expectOne((r) => r.url === `${VET_API}/${VET}/clients`).flush({ items: clients, page: 0, size: 100, total: clients.length });
    http.expectOne((r) => r.url === `${VET_API}/${VET}/patients`).flush({ items: patients, page: 0, size: 100, total: patients.length });
    for (const p of patients as { petId: string }[]) {
      http.expectOne(`${VET_API}/${VET}/patients/${p.petId}`).flush({ ...p, ...detail });
    }
  };

  it('loadPeople cruza cada mascota con su dueño y arma Clientes', () => {
    store.loadPeople().subscribe();
    flushPeople([CLIENT, { userId: 'u2', name: 'Ana Gómez', email: null, linkedAt: '2026-10-05T10:00:00', sharedPetsCount: 0 }], [PET_MAX]);

    expect(store.peopleState()).toBe('ready');
    expect(store.patients().length).toBe(1);
    expect(store.patients()[0].owner).toBe('Carlos Pérez');
    expect(store.clients().length).toBe(2);
    const carlos = store.clients().find((c) => c.id === 'u1')!;
    expect(carlos.pets.map((p) => p.name)).toEqual(['Max']);
    // Un dueño vinculado sin mascotas compartidas también es cliente.
    expect(store.clients().find((c) => c.id === 'u2')!.pets).toEqual([]);
  });

  it('completa cada paciente con el detalle: edad, sexo y foto (la lista no los trae)', () => {
    store.loadPeople().subscribe();
    const withPhoto = { ...PET_MAX, photoUrl: 'https://x/max.jpg' };
    flushPeople([CLIENT], [withPhoto]);
    const max = store.patients()[0];
    expect(max.sex).toBe('Macho');
    expect(max.birthDate).toBe('2015-04-02');
    expect(max.age).toMatch(/años$/);
    expect(max.photoUrl).toBe('https://x/max.jpg');
    // La ficha del cliente usa los mismos pacientes: también quedan completos.
    expect(store.clients()[0].pets[0].age).toBe(max.age);
  });

  it('si el detalle de un paciente falla, queda con lo básico y no rompe la lista', () => {
    store.loadPeople().subscribe();
    http.expectOne((r) => r.url === `${VET_API}/${VET}/clients`).flush({ items: [CLIENT], page: 0, size: 100, total: 1 });
    http.expectOne((r) => r.url === `${VET_API}/${VET}/patients`).flush({ items: [PET_MAX], page: 0, size: 100, total: 1 });
    http.expectOne(`${VET_API}/${VET}/patients/p1`).flush({ code: 'PATIENT_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    expect(store.peopleState()).toBe('ready');
    expect(store.patients()[0].name).toBe('Max');
    expect(store.patients()[0].age).toBe('—');
  });

  it('al recargar conserva la edad y el sexo ya traídos (sin parpadeo)', () => {
    store.loadPeople().subscribe();
    flushPeople([CLIENT], [PET_MAX]);
    const age = store.patients()[0].age;
    store.loadPeople().subscribe();
    http.expectOne((r) => r.url === `${VET_API}/${VET}/clients`).flush({ items: [CLIENT], page: 0, size: 100, total: 1 });
    http.expectOne((r) => r.url === `${VET_API}/${VET}/patients`).flush({ items: [PET_MAX], page: 0, size: 100, total: 1 });
    expect(store.patients()[0].age).toBe(age);
    expect(store.patients()[0].sex).toBe('Macho');
    http.expectOne(`${VET_API}/${VET}/patients/p1`).flush({ ...PET_MAX, sex: 'MALE', birthDate: '2015-04-02' });
  });

  it('pide todas las páginas cuando hay más de las que caben en una', () => {
    store.loadPeople().subscribe();
    http.expectOne((r) => r.url === `${VET_API}/${VET}/clients`).flush({ items: [CLIENT], page: 0, size: 1, total: 2 });
    http.expectOne((r) => r.url === `${VET_API}/${VET}/patients`).flush({ items: [], page: 0, size: 100, total: 0 });
    const second = http.expectOne((r) => r.url === `${VET_API}/${VET}/clients` && r.params.get('page') === '1');
    second.flush({ items: [{ ...CLIENT, userId: 'u9', name: 'Otro' }], page: 1, size: 1, total: 2 });
    expect(store.clientList().map((c) => c.userId)).toEqual(['u1', 'u9']);
  });

  it('si el backend falla (clínica sin aprobar, 403/409), queda en error y no inventa datos', () => {
    store.loadPeople().subscribe();
    http.expectOne((r) => r.url === `${VET_API}/${VET}/clients`).flush({ code: 'CLINIC_NOT_ACTIVE' }, { status: 409, statusText: 'Conflict' });
    // La petición de pacientes se cancela sola: forkJoin falla en cuanto una de las dos falla.
    http.match((r) => r.url === `${VET_API}/${VET}/patients`);
    expect(store.peopleState()).toBe('error');
    expect(store.clients()).toEqual([]);
  });

  it('removeClient llama DELETE con el userId y recarga las listas', () => {
    let revoked = -1;
    store.removeClient('u1').subscribe((n) => (revoked = n));
    const del = http.expectOne(`${VET_API}/${VET}/clients/u1`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ userId: 'u1', veterinaryId: VET, revokedPetsCount: 2, message: 'User unlinked successfully' });
    flushPeople([], []);
    expect(revoked).toBe(2);
    expect(store.clients()).toEqual([]);
  });

  it('removeClient con 404 USER_NOT_LINKED devuelve el error y no recarga', () => {
    let failed = false;
    store.removeClient('u1').subscribe({ error: () => (failed = true) });
    http.expectOne(`${VET_API}/${VET}/clients/u1`).flush({ code: 'USER_NOT_LINKED' }, { status: 404, statusText: 'Not Found' });
    expect(failed).toBeTrue();
  });

  it('loadLinkCode usa GET link-code y no pisa el código con null', () => {
    store.linkCode.set('VET-AAAAAAAA');
    store.loadLinkCode().subscribe();
    http.expectOne(`${VET_API}/${VET}/link-code`).flush({ inviteCode: null });
    expect(store.linkCode()).toBe('VET-AAAAAAAA');

    store.loadLinkCode().subscribe();
    http.expectOne(`${VET_API}/${VET}/link-code`).flush({ inviteCode: 'VET-7K2M9QXA' });
    expect(store.linkCode()).toBe('VET-7K2M9QXA');
  });

  it('reset olvida clientes, pacientes y estado', () => {
    store.loadPeople().subscribe();
    flushPeople([CLIENT], [PET_MAX]);
    store.reset();
    expect(store.clientList()).toEqual([]);
    expect(store.patients()).toEqual([]);
    expect(store.peopleState()).toBe('idle');
  });
});
