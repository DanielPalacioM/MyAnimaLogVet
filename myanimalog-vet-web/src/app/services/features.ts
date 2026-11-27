import { environment } from '@env/environment';

/**
 * Funciones que ya tienen backend (ver `environment.features`). Las apagadas muestran su pantalla vacía
 * y avisan que están por conectarse, en vez de guardar datos que se pierden al recargar.
 */
export const FEATURES = environment.features;

export type FeatureName = keyof typeof FEATURES;

export const FEATURE_MESSAGE: Record<FeatureName, string> = {
  patients: 'Registrar pacientes sin app todavía no está publicado en el backend (no aparece en la colección de Veterinary): estará disponible pronto.',
  appointments: 'La agenda se conecta con el servicio de citas: estará disponible pronto.',
  catalog: 'Crear y editar servicios aún no está publicado en el backend (VET-31): por ahora se ven los servicios reservables en línea.',
  schedule: 'El horario de atención y los bloqueos aún no están publicados en el backend (VET-32): estarán disponibles pronto.',
  professionalSchedule: 'Los horarios por profesional estarán disponibles pronto.',
};
