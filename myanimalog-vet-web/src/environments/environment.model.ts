/** Configuración que cambia por ambiente (local, producción en Cloud Run). */
export interface Environment {
  /** Nombre del ambiente, solo informativo. */
  name: string;
  /** Base del User service (login, refresh, token de clínica). Sin barra final. */
  userApiUrl: string;
  /** Base del veterinary-service (o del gateway). Sin barra final y sin `/api/veterinary`. */
  vetApiUrl: string;
  /**
   * Funciones que ya tienen backend. Las que están en `false` muestran su pantalla vacía
   * y avisan "disponible pronto" en vez de guardar datos de mentira.
   */
  /**
   * ID de cliente de Google (ingreso con Google). Es público. El origen del panel (localhost y el dominio real)
   * tiene que estar en sus "Orígenes autorizados" en Google Cloud.
   */
  googleClientId: string;
  /** Versiones de los textos legales que se aceptan al registrar. Deben coincidir con las del servidor. */
  legal: { dataPolicyVersion: string; termsVersion: string };
  features: {
    patients: boolean;
    appointments: boolean;
    catalog: boolean;
    schedule: boolean;
  };
}
