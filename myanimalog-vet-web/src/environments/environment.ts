import { Environment } from './environment.model';

/**
 * Producción (Cloud Run). Reemplazar por las URLs reales del User service y del veterinary-service
 * (o del gateway) antes de desplegar. Ver docs/ENTORNOS.md.
 */
export const environment: Environment = {
  name: 'production',
  userApiUrl: 'https://REEMPLAZAR-user-service-xxxxx.run.app',
  vetApiUrl: 'https://REEMPLAZAR-veterinary-service-xxxxx.run.app',
  googleClientId: '197571675834-sf7vdbok5ubm1qk63gfgp31mvn8srhen.apps.googleusercontent.com',
  legal: { dataPolicyVersion: '2026-10-v1', termsVersion: '2026-10-v1' },
  features: { patients: false, appointments: false, catalog: false, schedule: false },
};
