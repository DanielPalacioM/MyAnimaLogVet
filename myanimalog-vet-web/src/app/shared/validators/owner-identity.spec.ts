import { FormControl } from '@angular/forms';
import { ownerFullNameValidator, ownerPhoneValidator } from './common';
import { fullNameOut, patientBodyFrom, phoneOut } from '../../services/api/mappers';

// "Registrar sin app": el dueño se valida con las mismas reglas del User service (docs/NOMBRE_Y_TELEFONO.md).
describe('dueño al registrar sin app · nombre completo y teléfono', () => {
  const name = (v: string) => ownerFullNameValidator(new FormControl(v));
  const phone = (v: string) => ownerPhoneValidator(new FormControl(v));

  it('nombre completo: letras con tildes y ñ, guion y apóstrofe; nada de < >', () => {
    expect(name('José Peña-O\'Neil')).toBeNull();
    expect(name('Ana')).toBeNull();
    expect(name('A')).not.toBeNull();
    expect(name('Luis <script>')).not.toBeNull();
    expect(name('x'.repeat(101))).not.toBeNull();
  });

  it('teléfono: acepta como lo escribe la persona y rechaza lo que no es número', () => {
    expect(phone('')).toBeNull();
    expect(phone('3001234567')).toBeNull();
    expect(phone('300 123 4567')).toBeNull();
    expect(phone('+57 300 123 4567')).toBeNull();
    expect(phone('604 123 4567')).toBeNull();
    expect(phone('not-a-phone')).not.toBeNull();
    expect(phone('12345')).not.toBeNull();
  });

  it('se manda en E.164 y con el nombre sin espacios de más', () => {
    expect(phoneOut('+57 300 123 4567')).toBe('+573001234567');
    expect(phoneOut('300-123-4567')).toBe('+573001234567');
    expect(fullNameOut('  Ana   María  Ruiz ')).toBe('Ana María Ruiz');
    const body = patientBodyFrom({ name: 'Mia', species: 'Gato', breed: 'Siamés', ownerName: ' Ana  Ruiz ', ownerEmail: 'a@b.co', ownerPhone: '+57 300 123 4567', ownerDocumentType: 'CC', ownerDocumentNumber: '998877' });
    expect(body.owner.fullName).toBe('Ana Ruiz');
    expect(body.owner.phone).toBe('+573001234567');
  });
});
