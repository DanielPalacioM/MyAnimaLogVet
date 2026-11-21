/** Configuración que cambia por ambiente (local, producción en Cloud Run). */
export interface Environment {
  /** Nombre del ambiente, solo informativo. */
  name: string;
  /** Base del User service (login, refresh, token de clínica). Sin barra final. */
  userApiUrl: string;
  /** Base del veterinary-service (o del gateway). Sin barra final y sin `/api/veterinary`. */
  vetApiUrl: string;
  /** Base del calendar-service (citas), con `/api` y sin barra final. En local puede ser el mismo gateway. */
  calendarApiUrl: string;
  /**
   * Funciones que ya tienen backend. Las que están en `false` muestran su pantalla vacía
   * y avisan "disponible pronto" en vez de guardar datos de mentira.
   */
  /**
   * ID de cliente de Google (ingreso con Google). Es público. El origen del panel (localhost y el dominio real)
   * tiene que estar en sus "Orígenes autorizados" en Google Cloud.
   */
  googleClientId: string;
  /** Dirección pública de la app del dueño (MyAnimaLog). Va en el enlace que la clínica le manda al dueño para vincularse. */
  ownerAppUrl: string;
  /** Versiones de los textos legales que se aceptan al registrar. Deben coincidir con las del servidor. */
  legal: { dataPolicyVersion: string; termsVersion: string };
  features: {
    patients: boolean;
    appointments: boolean;
    catalog: boolean;
    schedule: boolean;
    professionalSchedule: boolean;
  };
}
