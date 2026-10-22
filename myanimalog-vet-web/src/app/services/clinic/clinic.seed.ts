import { addDays, at, dayMonth, startOfDay } from './date.utils';
import { Appointment, AppointmentStatus, ClinicService, Patient, Professional, Species, VaccineState } from './clinic.models';

export const PROFESSIONALS: Professional[] = [
  { id: 'luis', name: 'Dr. Luis Pérez', initials: 'LP', role: 'Médico veterinario', color: '#F5A623', verified: true },
  { id: 'sara', name: 'Dra. Sara Ruiz', initials: 'SR', role: 'Médica veterinaria', color: '#C9C6EE', verified: true },
  { id: 'camila', name: 'Camila Mora', initials: 'CM', role: 'Peluquería', color: '#A8EBDD', verified: false },
];

export const SERVICES: ClinicService[] = [
  { id: 's1', name: 'Consulta general', minutes: 30, professionalIds: ['luis', 'sara'] },
  { id: 's2', name: 'Vacunación', minutes: 30, professionalIds: ['luis', 'sara'] },
  { id: 's3', name: 'Control posoperatorio', minutes: 30, professionalIds: ['luis', 'sara'] },
  { id: 's4', name: 'Desparasitación', minutes: 30, professionalIds: ['luis', 'sara'] },
  { id: 's5', name: 'Baño y corte', minutes: 60, professionalIds: ['camila'] },
];

type Seed = [string, Species, string, string, string, string, string, string, number, VaccineState, boolean];
// nombre, especie, raza, edad, dueño, teléfono, última visita (texto), servicio, días atrás, vacunas, en la app
const FIRST: Seed[] = [
  ['Toby', 'Perro', 'Beagle', '4 años', 'Carlos Mendoza', '300 123 4567', '22 sep', 'Esterilización', 44, 'OK', true],
  ['Luna', 'Gato', 'Criolla', '2 años', 'Valentina Ríos', '315 884 2201', 'Hoy', 'Vacunación', 0, 'OK', true],
  ['Max', 'Perro', 'Criollo', '5 años', 'Carlos Pérez', '300 765 1122', 'Hoy', 'Consulta general', 0, 'DUE', false],
  ['Pelusa', 'Gato', 'Persa', '7 años', 'Laura Gómez', '311 450 9087', '14 ago', 'Control de piel', 53, 'OVERDUE', true],
  ['Kira', 'Perro', 'Labrador', '1 año', 'Andrés Torres', '320 117 6645', '30 sep', 'Consulta general', 36, 'OK', true],
  ['Simón', 'Gato', 'Schnauzer', '9 años', 'Marta Lucía Díaz', '304 982 3310', '12 sep', 'Control cardíaco', 54, 'DUE', true],
  ['Nala', 'Gato', 'Siamesa', '3 años', 'Juliana Castro', '318 220 4471', '1 jul', 'Desparasitación', 107, 'OVERDUE', true],
  ['Bruno', 'Perro', 'Pug', '6 años', 'Felipe Herrera', '301 556 7788', '2 sep', 'Baño y corte', 64, 'OK', true],
  ['Coco', 'Otro', 'Conejo', '2 años', 'Sofía Vargas', '316 004 5590', '28 sep', 'Consulta general', 38, 'NONE', false],
];

const DOG_NAMES = ['Rocky', 'Thor', 'Lola', 'Zeus', 'Canela', 'Rufo', 'Maya', 'Bella', 'Duke', 'Chispa', 'Nico', 'Sasha', 'Odie', 'Fiona', 'Apolo', 'Mía', 'Terry', 'Lucky', 'Pancho', 'Greta'];
const CAT_NAMES = ['Michi', 'Garfield', 'Mishka', 'Cleo', 'Tigre', 'Félix', 'Nube', 'Pelusín', 'Sombra', 'Mimi', 'Oliver', 'Kiara'];
const OTHER_NAMES = ['Piolín', 'Rayo', 'Copito', 'Tuco', 'Nemo', 'Pipo', 'Dorada'];
const DOG_BREEDS = ['Criollo', 'Labrador', 'Golden retriever', 'Pastor alemán', 'Bulldog francés', 'Poodle', 'Schnauzer', 'Beagle', 'Husky'];
const CAT_BREEDS = ['Criolla', 'Siamesa', 'Persa', 'Angora', 'Bengalí'];
const OTHER_BREEDS = ['Conejo', 'Hámster', 'Cobaya', 'Loro', 'Tortuga'];
const FIRST_NAMES = ['Camila', 'Daniel', 'Paula', 'Sebastián', 'Natalia', 'Jorge', 'Mariana', 'Esteban', 'Lucía', 'Ricardo', 'Isabela', 'Mateo', 'Carolina', 'Julián', 'Andrea', 'Santiago'];
const LAST_NAMES = ['Rojas', 'Mejía', 'Cárdenas', 'Ospina', 'Reyes', 'Quintero', 'Salazar', 'Pineda', 'Bermúdez', 'Navarro', 'Cortés', 'Londoño', 'Aguirre', 'Pardo'];
const VISIT_SERVICES = ['Consulta general', 'Vacunación', 'Desparasitación', 'Control de peso', 'Baño y corte', 'Control de piel'];

/** Generador determinista (siempre los mismos datos de prueba). */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function toPatient(i: number, s: Seed, today: number): Patient {
  const [name, species, breed, age, owner, phone, label, service, daysAgo, vaccines, inApp] = s;
  const when = addDays(today, -daysAgo);
  return {
    id: `p-${i}`,
    name,
    species,
    breed,
    age,
    owner,
    phone,
    lastVisit: label || (daysAgo === 0 ? 'Hoy' : dayMonth(when)),
    lastVisitService: service,
    lastVisitAt: when,
    vaccines,
    inApp,
  };
}

/** 248 pacientes: 161 perros, 79 gatos y 8 de otras especies (como el diseño). */
export function buildPatients(today: number): Patient[] {
  const r = rng(7);
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)];
  const patients: Patient[] = FIRST.map((s, i) => toPatient(i, s, today));
  const plan: Species[] = [
    ...Array<Species>(156).fill('Perro'),
    ...Array<Species>(76).fill('Gato'),
    ...Array<Species>(7).fill('Otro'),
  ];
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  const overdueAt = new Set([12, 57, 101, 190]);
  const unclaimedAt = new Set([30, 140]);
  plan.forEach((species, i) => {
    const names = species === 'Perro' ? DOG_NAMES : species === 'Gato' ? CAT_NAMES : OTHER_NAMES;
    const breeds = species === 'Perro' ? DOG_BREEDS : species === 'Gato' ? CAT_BREEDS : OTHER_BREEDS;
    const daysAgo = 1 + Math.floor(r() * 300);
    const vaccines: VaccineState = overdueAt.has(i) ? 'OVERDUE' : r() < 0.12 ? 'DUE' : r() < 0.04 ? 'NONE' : 'OK';
    const owner = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const phone = `3${10 + Math.floor(r() * 15)} ${100 + Math.floor(r() * 899)} ${1000 + Math.floor(r() * 8999)}`;
    patients.push(
      toPatient(
        9 + i,
        [pick(names), species, pick(breeds), `${1 + Math.floor(r() * 12)} años`, owner, phone, '', pick(VISIT_SERVICES), daysAgo, vaccines, !unclaimedAt.has(i)],
        today,
      ),
    );
  });
  return patients;
}

/** Agenda de hoy y algunos días cercanos, igual que el diseño (Figma 1941:174). */
export function buildAppointments(today: number, patients: Patient[]): Appointment[] {
  const byName = (n: string) => patients.find((p) => p.name === n)!;
  let n = 0;
  const mk = (
    day: number,
    hhmm: string,
    patient: string,
    service: string,
    professionalId: string,
    status: AppointmentStatus,
    minutes = 30,
    source: 'APP' | 'CLINIC' = 'CLINIC',
  ): Appointment => {
    const p = byName(patient);
    return {
      id: `a-${++n}`,
      patientId: p.id,
      patientName: p.name,
      service,
      professionalId,
      start: at(addDays(today, day), hhmm),
      minutes,
      status,
      source,
    };
  };
  return [
    mk(0, '08:00', 'Max', 'Consulta general', 'luis', 'COMPLETED'),
    mk(0, '08:30', 'Pelusa', 'Vacunación', 'luis', 'NO_SHOW'),
    mk(0, '09:30', 'Luna', 'Vacunación', 'luis', 'CHECKED_IN'),
    mk(0, '14:00', 'Simón', 'Vacunación', 'luis', 'CONFIRMED'),
    mk(0, '10:30', 'Toby', 'Control posoperatorio', 'sara', 'CONFIRMED'),
    mk(0, '11:30', 'Kira', 'Consulta general', 'sara', 'REQUESTED'),
    mk(0, '16:00', 'Nala', 'Consulta general', 'sara', 'CONFIRMED'),
    mk(0, '09:00', 'Bruno', 'Baño y corte', 'camila', 'COMPLETED', 60),
    mk(0, '15:00', 'Coco', 'Baño y corte', 'camila', 'CONFIRMED', 60),
    // Solicitudes que llegan desde la app
    mk(1, '09:00', 'Toby', 'Vacunación', 'luis', 'REQUESTED', 30, 'APP'),
    mk(2, '16:00', 'Luna', 'Consulta general', 'sara', 'REQUESTED', 30, 'APP'),
    // Otros días (puntos del calendario)
    mk(3, '10:00', 'Max', 'Consulta general', 'luis', 'CONFIRMED'),
    mk(5, '11:00', 'Kira', 'Vacunación', 'sara', 'CONFIRMED'),
    mk(-1, '10:00', 'Simón', 'Control cardíaco', 'luis', 'COMPLETED'),
    mk(-2, '15:00', 'Bruno', 'Baño y corte', 'camila', 'COMPLETED', 60),
    mk(7, '09:30', 'Nala', 'Desparasitación', 'luis', 'CONFIRMED'),
  ];
}

export const TODAY = () => startOfDay(Date.now());
