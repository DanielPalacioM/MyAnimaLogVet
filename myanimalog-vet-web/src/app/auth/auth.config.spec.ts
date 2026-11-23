import { CALENDAR_API, VET_API, usesNormalToken } from './auth.config';

describe('usesNormalToken', () => {
  it('el catálogo reservable de Calendar es ruta de dueño (token normal)', () => {
    expect(usesNormalToken(`${CALENDAR_API}/veterinaries/abc/services`)).toBeTrue();
  });

  it('las citas de la clínica usan el token de clínica', () => {
    expect(usesNormalToken(`${CALENDAR_API}/veterinaries/abc/appointments?from=x`)).toBeFalse();
    expect(usesNormalToken(`${CALENDAR_API}/veterinaries/abc/appointments/1/confirm`)).toBeFalse();
  });

  it('lo del veterinary-service sigue igual', () => {
    expect(usesNormalToken(`${VET_API}/me`)).toBeTrue();
    expect(usesNormalToken(`${VET_API}/abc/clients`)).toBeFalse();
  });
});
