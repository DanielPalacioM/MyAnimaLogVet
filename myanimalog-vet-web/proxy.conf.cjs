/**
 * Proxy de desarrollo hacia el gateway de Cloud Run.
 * El gateway responde 403 (CORS) a cualquier petición que lleve cabecera Origin que no esté en su lista,
 * como http://localhost:4200. El proxy hace la llamada de servidor a servidor, así que se quita Origin y Referer.
 */
const https = require('node:https');

const target = 'https://pets-api-gateway-20369076707.us-central1.run.app';

const common = {
  target,
  secure: true,
  // Sin conexiones reutilizadas: Cloud Run cierra las inactivas y la siguiente petición fallaba con "socket hang up".
  agent: new https.Agent({ keepAlive: false }),
  changeOrigin: true,
  // Angular 20 usa el proxy de Vite (http-proxy): los eventos se enganchan en `configure`.
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
    });
  },
};

// Calendar (citas) es un servicio aparte en Cloud Run: el gateway no publica sus rutas (/api/veterinaries/... da 404).
// Para probar contra el servicio local: CALENDAR_TARGET=http://localhost:3000 npm start   (su base ya es `/api`)
const calendarTarget = process.env.CALENDAR_TARGET;
const calendar = {
  ...common,
  target: calendarTarget ?? 'https://calendar-microservice-20369076707.us-central1.run.app',
  secure: !calendarTarget || calendarTarget.startsWith('https'),
  pathRewrite: { '^/calendar-api': '/api' },
};

module.exports = {
  '/user-api': { ...common, pathRewrite: { '^/user-api': '/api' } },
  '/vet-api': { ...common, pathRewrite: { '^/vet-api': '' } },
  '/calendar-api': calendar,
};
