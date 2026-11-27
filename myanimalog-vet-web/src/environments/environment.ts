import { Environment } from './environment.model';

/**
 * Producción: todo por el gateway de Cloud Run (permite CORS desde el dominio del panel).
 * Calendar no manda CORS: va por el mismo dominio y Firebase Hosting lo reenvía a Cloud Run
 * (`/api/**` → `calendar-microservice`, ver `firebase.json`).
 */
export const environment: Environment = {
  name: 'production',
  userApiUrl: 'https://pets-api-gateway-20369076707.us-central1.run.app/api',
  vetApiUrl: 'https://pets-api-gateway-20369076707.us-central1.run.app',
  calendarApiUrl: '/api',
  ownerAppUrl: 'https://project-ea0d4de8-cedf-4542-8fa.web.app',
  googleClientId: '197571675834-sf7vdbok5ubm1qk63gfgp31mvn8srhen.apps.googleusercontent.com',
  legal: { dataPolicyVersion: '2026-10-v1', termsVersion: '2026-10-v1' },
  features: { patients: false, appointments: true, catalog: true, schedule: true, professionalSchedule: true },
};
