export interface Department {
  name: string;
  cities: readonly string[];
}

/**
 * Departamentos de Colombia con su capital y principales ciudades.
 * TODO: reemplazar por el catálogo completo de la DIVIPOLA (o el endpoint del backend) cuando exista.
 */
export const DEPARTMENTS: readonly Department[] = [
  { name: 'Amazonas', cities: ['Leticia'] },
  { name: 'Antioquia', cities: ['Medellín', 'Bello', 'Envigado', 'Itagüí', 'Rionegro', 'Sabaneta', 'Apartadó', 'Turbo'] },
  { name: 'Arauca', cities: ['Arauca', 'Saravena', 'Tame'] },
  { name: 'Atlántico', cities: ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Puerto Colombia'] },
  { name: 'Bogotá D.C.', cities: ['Bogotá'] },
  { name: 'Bolívar', cities: ['Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar'] },
  { name: 'Boyacá', cities: ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá'] },
  { name: 'Caldas', cities: ['Manizales', 'La Dorada', 'Chinchiná', 'Villamaría'] },
  { name: 'Caquetá', cities: ['Florencia', 'San Vicente del Caguán'] },
  { name: 'Casanare', cities: ['Yopal', 'Aguazul', 'Villanueva'] },
  { name: 'Cauca', cities: ['Popayán', 'Santander de Quilichao', 'Puerto Tejada'] },
  { name: 'Cesar', cities: ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia'] },
  { name: 'Chocó', cities: ['Quibdó', 'Istmina', 'Tadó'] },
  { name: 'Córdoba', cities: ['Montería', 'Cereté', 'Lorica', 'Sahagún', 'Montelíbano'] },
  { name: 'Cundinamarca', cities: ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Fusagasugá', 'Girardot', 'Mosquera', 'Cajicá'] },
  { name: 'Guainía', cities: ['Inírida'] },
  { name: 'Guaviare', cities: ['San José del Guaviare'] },
  { name: 'Huila', cities: ['Neiva', 'Pitalito', 'Garzón', 'La Plata'] },
  { name: 'La Guajira', cities: ['Riohacha', 'Maicao', 'Uribia', 'Fonseca'] },
  { name: 'Magdalena', cities: ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco'] },
  { name: 'Meta', cities: ['Villavicencio', 'Acacías', 'Granada', 'Puerto López'] },
  { name: 'Nariño', cities: ['Pasto', 'Tumaco', 'Ipiales'] },
  { name: 'Norte de Santander', cities: ['Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario'] },
  { name: 'Putumayo', cities: ['Mocoa', 'Puerto Asís', 'Orito'] },
  { name: 'Quindío', cities: ['Armenia', 'Calarcá', 'Montenegro', 'La Tebaida'] },
  { name: 'Risaralda', cities: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'] },
  { name: 'San Andrés y Providencia', cities: ['San Andrés', 'Providencia'] },
  { name: 'Santander', cities: ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil'] },
  { name: 'Sucre', cities: ['Sincelejo', 'Corozal', 'Sampués'] },
  { name: 'Tolima', cities: ['Ibagué', 'Espinal', 'Melgar', 'Chaparral'] },
  { name: 'Valle del Cauca', cities: ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Buga', 'Cartago', 'Jamundí', 'Yumbo'] },
  { name: 'Vaupés', cities: ['Mitú'] },
  { name: 'Vichada', cities: ['Puerto Carreño'] },
];

/** Separador del valor del selector "Departamento / ciudad". */
const SEP = '|';

export function locationValue(department: string, city: string): string {
  return department && city ? `${department}${SEP}${city}` : '';
}

export function parseLocation(value: string): { department: string; city: string } {
  const [department = '', city = ''] = value.split(SEP);
  return { department, city };
}

/** Caja aproximada de Colombia continental e insular cercana, para descartar ubicaciones imposibles. */
export const COLOMBIA_BOUNDS = { minLat: -4.3, maxLat: 13.6, minLng: -81.8, maxLng: -66.8 } as const;
