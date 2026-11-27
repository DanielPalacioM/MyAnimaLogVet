import { appointmentFrom, appointmentStatusFrom, categoryFrom, categoryToApi, serviceFrom } from './mappers';
import { patientFrom } from './mappers';

const PET = patientFrom({ petId: 'pet-1', name: 'Toby', species: 'DOG', breed: 'Criollo', photoUrl: null, ownerUserId: 'u1', grantedAt: '2026-11-08T14:10:00' }, 'Carlos');
const SERVICE = serviceFrom({ id: 'svc-1', name: 'Vacunación', category: 'VACCINATION', durationMinutes: 15, price: 35000, bookableOnline: true, active: true });

// Forma que confirma la colección "Calendar Microservice": id, status, origin, employeeId, startsAt, endsAt.
const DTO = {
  id: 'a1',
  status: 'REQUESTED',
  origin: 'APP',
  employeeId: 'emp-1',
  petId: 'pet-1',
  serviceId: 'svc-1',
  startsAt: '2026-12-07T15:00:00.000Z',
  endsAt: '2026-12-07T15:30:00.000Z',
  notes: ' Se lame la herida ',
};

describe('mappers de citas', () => {
  it('appointmentFrom cruza la mascota y el servicio con lo ya cargado', () => {
    const a = appointmentFrom(DTO, [PET], [SERVICE]);
    expect(a).toEqual(jasmine.objectContaining({
      id: 'a1', patientId: 'pet-1', patientName: 'Toby', service: 'Vacunación', serviceId: 'svc-1', price: 35000,
      professionalId: 'emp-1', status: 'REQUESTED', source: 'APP', note: 'Se lame la herida',
    }));
    expect(a.start).toBe(new Date('2026-12-07T15:00:00.000Z').getTime());
  });

  it('la duración sale de startsAt/endsAt (30 min), no del catálogo (15 min)', () => {
    expect(appointmentFrom(DTO, [PET], [SERVICE]).minutes).toBe(30);
  });

  it('sin endsAt usa la duración de la cita o del catálogo', () => {
    expect(appointmentFrom({ ...DTO, endsAt: null }, [PET], [SERVICE]).minutes).toBe(15);
    expect(appointmentFrom({ ...DTO, endsAt: null, durationMinutes: 45 }, [PET], []).minutes).toBe(45);
  });

  it('si la mascota o el servicio no están cargados, usa lo que diga la cita o un nombre neutro', () => {
    expect(appointmentFrom({ ...DTO, petName: 'Luna', serviceName: 'Baño' }, [], []).patientName).toBe('Luna');
    expect(appointmentFrom({ ...DTO, petName: 'Luna', serviceName: 'Baño' }, [], []).service).toBe('Baño');
    const bare = appointmentFrom(DTO, [], []);
    expect(bare.patientName).toBe('Mascota');
    expect(bare.service).toBe('Servicio');
  });

  it('acepta mascota y servicio anidados', () => {
    const a = appointmentFrom({ ...DTO, petId: null, serviceId: null, pet: { id: 'pet-1', name: 'Toby' }, service: { id: 'svc-1', name: 'Vacunación', price: 40000 } }, [], []);
    expect(a.patientId).toBe('pet-1');
    expect(a.price).toBe(40000);
  });

  it('el origen distinto de APP es CLINIC', () => {
    expect(appointmentFrom({ ...DTO, origin: 'CLINIC' }, [], []).source).toBe('CLINIC');
    expect(appointmentFrom({ ...DTO, origin: null }, [], []).source).toBe('CLINIC');
  });

  it('REJECTED se muestra como cancelada y un estado desconocido como por confirmar', () => {
    expect(appointmentStatusFrom('REJECTED')).toBe('CANCELLED');
    expect(appointmentStatusFrom('checked_in')).toBe('CHECKED_IN');
    expect(appointmentStatusFrom('LO_QUE_SEA')).toBe('REQUESTED');
  });
});

describe('mappers del catálogo', () => {
  it('serviceFrom traduce categoría, duración y quién lo presta', () => {
    expect(SERVICE).toEqual(jasmine.objectContaining({ category: 'Vacunación', minutes: 15, price: 35000, online: true, active: true, professionalIds: [] }));
    expect(serviceFrom({ id: 's', name: 'X', duration_minutes: 20, bookable_online: true, employeeIds: ['e1'] })).toEqual(
      jasmine.objectContaining({ minutes: 20, online: true, professionalIds: ['e1'], active: true, price: 0 }),
    );
  });

  it('categoryFrom reconoce español, inglés y desconocidas', () => {
    expect(categoryFrom('Estética')).toBe('Estética');
    expect(categoryFrom('grooming')).toBe('Estética');
    expect(categoryFrom('raro')).toBe('Otro');
    expect(categoryFrom(null)).toBe('Otro');
  });

  it('categoryToApi y categoryFrom son inversas', () => {
    for (const c of ['Consulta', 'Vacunación', 'Estética', 'Laboratorio', 'Cirugía', 'Otro'] as const) {
      expect(categoryFrom(categoryToApi(c))).toBe(c);
    }
  });
});

import { blockFrom, blockToApi, scheduleFrom, scheduleToApi } from './mappers';

describe('mappers de horario y bloqueos', () => {
  it('scheduleFrom pasa lunes=1 a lunes=0, junta tramos y deja cerrados los días sin tramos', () => {
    const days = scheduleFrom([
      { dayOfWeek: 1, opensAt: '14:00:00', closesAt: '18:00:00' },
      { dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
      { dayOfWeek: 6, startsAt: '08:00', endsAt: '12:00' },
    ]);
    expect(days.length).toBe(7);
    expect(days[0]).toEqual({ day: 0, open: true, ranges: [['08:00', '12:00'], ['14:00', '18:00']] });
    expect(days[1].open).toBeFalse();
    expect(days[5].ranges).toEqual([['08:00', '12:00']]);
    expect(days[6].open).toBeFalse();
  });

  it('scheduleToApi es la inversa y omite los días cerrados', () => {
    const rows = scheduleToApi(scheduleFrom([{ dayOfWeek: 3, opensAt: '09:00', closesAt: '13:00' }]));
    expect(rows).toEqual([{ dayOfWeek: 3, opensAt: '09:00', closesAt: '13:00' }]);
  });

  it('un bloqueo de días completos ida y vuelta', () => {
    const date = new Date(2026, 11, 24).getTime();
    const endDate = new Date(2026, 11, 26).getTime();
    const body = blockToApi({ title: 'Navidad', date, endDate, scope: 'CLINIC', allDay: true });
    expect(body.employeeId).toBeNull();
    const back = blockFrom({ id: 'b1', startsAt: body.startsAt, endsAt: body.endsAt, reason: body.reason, employeeId: null });
    expect(back).toEqual(jasmine.objectContaining({ title: 'Navidad', date, endDate, allDay: true, scope: 'CLINIC' }));
  });

  it('un bloqueo con horas de un profesional ida y vuelta', () => {
    const date = new Date(2026, 11, 1).getTime();
    const body = blockToApi({ title: 'Cirugía', date, scope: 'emp-1', allDay: false, from: '09:00', to: '11:30' });
    expect(body.employeeId).toBe('emp-1');
    const back = blockFrom({ id: 'b2', startsAt: body.startsAt, endsAt: body.endsAt, reason: 'Cirugía', employeeId: 'emp-1' });
    expect(back).toEqual(jasmine.objectContaining({ allDay: false, from: '09:00', to: '11:30', scope: 'emp-1', endDate: undefined }));
  });
});

describe('registrar sin app (walk-in)', () => {
  it('arma el cuerpo del contrato: mascota, dueño con teléfono internacional e invitación', async () => {
    const { patientBodyFrom } = await import('./mappers');
    expect(patientBodyFrom({ name: ' Max ', species: 'Perro', breed: 'Criollo', ownerName: 'Carlos Pérez', ownerEmail: ' Carlos@Correo.COM ', ownerDocumentType: 'CC', ownerDocumentNumber: ' 1047123456 ' })).toEqual({
      pet: { name: 'Max', species: 'DOG', breed: 'Criollo' },
      owner: { fullName: 'Carlos Pérez', email: 'carlos@correo.com', documentType: 'CC', documentNumber: '1047123456' },
      sendClaimInvitation: true,
    });
    expect(patientBodyFrom({ name: 'Mia', species: 'Gato', breed: 'Siamés', sex: 'Hembra', birthDate: '2024-05-01', ownerName: 'Ana Ruiz', ownerEmail: 'a@b.co', ownerPhone: '300 123 4567', ownerDocumentType: 'CE', ownerDocumentNumber: '998877' })).toEqual({
      pet: { name: 'Mia', species: 'CAT', breed: 'Siamés', sex: 'FEMALE', birthDate: '2024-05-01' },
      owner: { fullName: 'Ana Ruiz', email: 'a@b.co', phone: '+573001234567', documentType: 'CE', documentNumber: '998877' },
      sendClaimInvitation: true,
    });
  });

  it('una mascota sin dueño en la app queda "Por reclamar" y muestra el contacto que dejó la clínica', () => {
    const p = patientFrom({ petId: 'p9', name: 'Max', species: 'DOG', breed: null, photoUrl: null, ownerUserId: null, grantedAt: '2026-11-23T10:00:00', claimStatus: 'UNCLAIMED', ownerContact: { fullName: 'Carlos Pérez', email: 'c@x.co', phone: '+573001234567' } }, 'Sin nombre');
    expect(p.inApp).toBeFalse();
    expect(p.owner).toBe('Carlos Pérez');
    expect(p.phone).toBe('+573001234567');
  });

  it('si no trae contacto, muestra el correo de la invitación; una mascota con dueño sigue "Conectada"', () => {
    const sin = patientFrom({ petId: 'p9', name: 'Max', species: 'DOG', breed: null, photoUrl: null, ownerUserId: null, grantedAt: '', claim: { status: 'UNCLAIMED', invitationEmail: 'c@x.co' } }, 'Sin nombre');
    expect(sin.owner).toBe('c@x.co');
    const con = patientFrom({ petId: 'p1', name: 'Leo', species: 'DOG', breed: null, photoUrl: null, ownerUserId: 'u1', grantedAt: '' }, 'Carlos');
    expect(con.inApp).toBeTrue();
    expect(con.owner).toBe('Carlos');
  });
});
