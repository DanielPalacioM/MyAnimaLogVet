# Entornos y conexión con el backend

El panel habla con **dos servicios**. Las URLs salen de `src/environments/` (alias `@env`).

| Archivo | Cuándo se usa | `userApiUrl` | `vetApiUrl` |
|---|---|---|---|
| `environment.development.ts` | `ng serve` / `ng build --configuration development` | `http://localhost:8080` | `http://localhost:8082` |
| `environment.ts` | `ng build` (producción, Cloud Run) | **REEMPLAZAR** | **REEMPLAZAR** |

> User service: 8080 (según tu docker-compose). El puerto 8081 es del pet-service. El 8082 del veterinary-service es una suposición: ajústalo al tuyo.
> Si hay un gateway, ambas URLs pueden ser la misma.

## Servicios y rutas (según la colección de Postman)

- **User service** (`userApiUrl`): `POST /auth/local` (login), `POST /auth/refresh`, `POST /auth/verify-email`.
- **veterinary-service** (`vetApiUrl`, prefijo `/api/veterinary`): `/me`, `/me/invitations`, `/register`, `/invitations/*`,
  `/{id}` (perfil, datos, ajustes, logo, código de vinculación, suscripción), `/{id}/employees`, `/{id}/invitations`, `/admin/*`.
- `POST /auth/context/veterinary/{id}` entrega el **token de clínica**.

## Tokens (lo resuelve `auth.interceptor.ts`)

| Petición | Token |
|---|---|
| `/auth/*`, `/me`, `/me/*`, `/invitations/*`, `/register`, `/link/*`, `/admin/*` | normal |
| `/api/veterinary/{id}/…` | de clínica |

- En `401` se renueva una sola vez (`refresh` rota el token), se vuelve a pedir el token de clínica y se reintenta.
- Si la renovación falla → cierra sesión. Si hay `403` con `NOT_CLINIC_MEMBER`, `TENANT_MISMATCH` o `CLINIC_CONTEXT_REQUIRED` → `/elegir-clinica`.
- `CLINIC_SUSPENDED`: solo funciona `GET /{id}`; el panel muestra el aviso con el motivo.

## Funciones por módulo (`features`)

Lo que aún no tiene backend queda apagado y la vista muestra “Disponible pronto” (sin datos inventados):
`patients`, `appointments`, `catalog`, `schedule`. Se encienden por entorno cuando exista el servicio.

Conectado hoy: login, selector de clínica, invitaciones (ver/aceptar/rechazar), Equipo, Mi clínica (datos, ajustes, logo, código), plan en Inicio.
Registro de clínica (conectado): `POST /user/register` → PIN al correo → `POST /auth/verify-email` → login automático →
`POST /register` → token de clínica → representante legal → documentos (PDF/JPG/PNG, 10 MB) → perfil profesional (si es veterinario) →
`POST /verification/submit`. La clínica queda `UNDER_REVIEW` y **la aprueba una persona del equipo** (endpoints `/admin`); el panel no
aprueba nada por su cuenta. El plazo de 48 h es un máximo: una aprobación antes es normal. Si un paso falla a la mitad, el reintento
continúa con la clínica ya creada (se recuerda por NIT). Las versiones legales salen de `environment.legal`.

## Panel de administración (equipo MyAnimaLog)

Ruta `/admin` (solo cuentas `PLATFORM_ADMIN`; el login las lleva directo ahí). Diseños: Figma `2040:300`, `2040:753`, `2192:300`, `2192:483`, `2192:666`.
- **Verificaciones:** cola con conteos y riesgo de la IA, detalle con datos declarados, documentos con enlace firmado de 10 min (visor dentro de la pantalla),
  reporte de la IA (solo apoyo), casilla obligatoria de "confirmé en el registro oficial" y las tres decisiones: aprobar, pedir corrección (documentos + nota) o rechazar (motivo + nota).
- **Clínicas:** lista con búsqueda y filtro por estado (en revisión, corrección, sin documentos, activas, suspendidas, rechazadas); suspender (motivo de 10 a 500 caracteres), reactivar, "Revisar" lleva a la solicitud y "Ver" abre la ficha (datos, dueño, equipo, historial y plan: crear o cambiar con `POST/PATCH /{id}/subscription`).
- **Profesionales:** lista con búsqueda por nombre o tarjeta y filtro de verificados; la ficha muestra el correo (único lugar donde se resuelve).
- Reactivar **no** aprueba clínicas nuevas (eso es solo `approve`), por eso el texto al pie de Clínicas difiere del Figma.
- Pendiente con backend: forma exacta de `declared` (profesional) y del reporte de la IA (`ai.report.checks`), y `fileSizeBytes` en los documentos.

## Después de aprobada (cubierto con Postman)

- **Pantalla de estado del registro** (`/registro/estado`): en revisión, corrección (nota del revisor + volver a subir solo lo pedido), sin documentos (tras "Nueva solicitud"), no aprobada (motivo, intentos y `POST /verification/retry`) y aprobada. Una clínica rechazada, en corrección o sin documentos se abre desde el selector con `?clinica=<id>` y el token normal.
- **Mi perfil profesional** (`/mi-perfil`, menú de la cuenta): datos, documentos, firma PNG y envío a revisión (`/me/professional-profile/*`).
- **Plan** (`/plan`): plan activo y `subscription/is-expired`. Límites de uso y cambio de plan, cuando el backend los publique.
- **Vínculo de clientes** (`link.api.ts`): vincular y desvincular; sin pantalla porque no hay endpoint que liste clientes.
- Sin conectar a propósito: `internal/*` y `jobs/*` (servicio a servicio) y los endpoints deprecados.

## Pendiente de confirmar con backend

- `POST /user/register`: cuerpo `{username, email, password}` (el de la app MyAnimaLog) y qué devuelve.
- `POST /auth/verify-email/resend` (no existe aún): sin él, "Reenviar código" avisa que no está disponible.
- Un endpoint para saber si NIT/nombre/correo de clínica ya existen antes de enviar (hoy se enteran al enviar, en "Revisar").
- Modo de pruebas del backend para aprobar clínicas al instante (variable de entorno, apagada en producción).

- Puertos/rutas reales de `/auth/me` y `/auth/refresh` en el User service.
- Ruta y parámetro del enlace de invitación (hoy `/invitacion?token=`).
- Si el perfil devuelve `inviteCode` y si el `PATCH` acepta dirección.
- URL del gateway (si existe).

## Despliegue en Google Cloud (después)

1. Poner las URLs reales en `environment.ts`.
2. `ng build` → `dist/myanimalog-vet-web`.
3. Publicar igual que MyAnimaLog (mismo paso a paso). Se detalla cuando llegue el momento.
4. Añadir el dominio del panel a CORS de ambos servicios.
