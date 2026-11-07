import { Environment } from './environment.model';

/**
 * Local: los servicios corren en tu máquina y el servidor de Angular los reenvía (proxy.conf.json),
 * así el navegador no hace peticiones entre orígenes y no depende del CORS del backend.
 * Si tus puertos son otros, cámbialos en proxy.conf.json.
 */
export const environment: Environment = {
  name: 'development',
  userApiUrl: '/user-api',
  vetApiUrl: '/vet-api',
  googleClientId: '197571675834-sf7vdbok5ubm1qk63gfgp31mvn8srhen.apps.googleusercontent.com',
  legal: { dataPolicyVersion: '2026-10-v1', termsVersion: '2026-10-v1' },
  features: { patients: false, appointments: false, catalog: false, schedule: false },
};
