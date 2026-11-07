import { environment } from '@env/environment';

/**
 * Funciones que ya tienen backend (ver `environment.features`). Las apagadas muestran su pantalla vacía
 * y avisan que están por conectarse, en vez de guardar datos que se pierden al recargar.
 */
export const FEATURES = environment.features;

export type FeatureName = keyof typeof FEATURES;

export const FEATURE_MESSAGE: Record<FeatureName, string> = {
  patients: 'Los pacientes se conectan con el servicio de mascotas: estará disponible pronto.',
  appointments: 'La agenda se conecta con el servicio de citas: estará disponible pronto.',
  catalog: 'El catálogo de servicios estará disponible pronto.',
  schedule: 'Los horarios y bloqueos estarán disponibles pronto.',
};
