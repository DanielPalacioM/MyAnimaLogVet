# MyAnimaLogVet — Parte del cliente (app del dueño)

> Extracto de [MYANIMALOG_VET_MAESTRO.md](MYANIMALOG_VET_MAESTRO.md) con todo lo que le toca a la app móvil MyAnimaLog (B2C, Ionic + Angular).
> El panel de la clínica (MyAnimaLogVet, B2B) es una web aparte y **no** está en este documento.
> Si algo aquí choca con el maestro, manda el maestro. Las referencias `§` apuntan a ese documento.
> Fecha: octubre 2026.

## Índice

1. Alcance de la app del dueño
2. Estado actual en este repo
3. Autenticación: lo que cambia (USER-01/02/05, PETS-02)
4. Directorio de veterinarias
5. Vincularse a una clínica
6. Compartir y revocar mascotas
7. Reclamar mascotas registradas por una clínica
8. Citas
9. Historia clínica: qué puede hacer el dueño
10. Notificaciones que recibe el dueño
11. Convenciones HTTP y errores
12. Dependencias de backend y orden sugerido de pantallas
13. Recorrido de prueba de punta a punta

---

## 1. Alcance de la app del dueño

La idea central del producto: **la historia de la mascota es del dueño y viaja con ella entre clínicas.** La clínica solo ve las mascotas que el dueño le comparte, y el dueño puede quitarle el acceso cuando quiera.

La app hace seis cosas en la parte Vet:

| # | Funcionalidad | Sección |
|---|---|---|
| 1 | Buscar clínicas en el directorio y ver su perfil y servicios | §4 |
| 2 | Vincularse a una clínica con código o QR, ver mis clínicas y desvincularme | §5 |
| 3 | Compartir mascotas con una clínica y revocar el acceso | §6 |
| 4 | Reclamar una mascota que una clínica registró a mi nombre | §7 |
| 5 | Pedir, ver, reprogramar y cancelar citas | §8 |
| 6 | Ver qué clínicas tienen acceso a cada mascota | §6 |

Lo que **no** hace la app: registrar clínicas, verificar documentos, gestionar personal, agenda de la clínica, suscripciones ni escribir historia clínica (eso lo hace la clínica).

---

## 2. Estado actual en este repo

- **`/maps`** ya busca veterinarias cercanas con Google Places, y desde ahí se puede agendar una cita local (`/calendar/add-event?type=VET_APPOINTMENT&title=&location=`), ver la ruta, llamar y abrir el sitio web. Son veterinarias de Google, no clínicas de MyAnimaLogVet.
- **Home, tarjeta MyAnimaLogVet:** "Buscar veterinaria" abre `/maps` (`onFindVet`). "Asociar veterinaria" (`onAsociationVet`) navega a `/vet`, **ruta que no existe**.
- **Home, acceso rápido "Vet":** navega a `/vet`, que tampoco existe.
- **Tab bar:** la pestaña "Vet" (`key: 'veterinary'`) apunta a `/veterinary`, que tampoco existe.
- **Antes de crear la pantalla:** unificar la ruta (`/vet` o `/veterinary`) en los tres lugares.
- **Datos:** hoy la veterinaria es texto libre (`veterinarian` en vacunas y visitas, `vetName` en Pet). No hay modelo `Vet` ni servicio. Hará falta un `VeterinaryService` nuevo en `services/` y los modelos en `models/`.

---

## 3. Autenticación: lo que cambia

> **No hacer esta migración hasta que el backend la despliegue** (USER-01, USER-02, PETS-01, PETS-02).

### 3.1 Login y tokens (USER-02)

- Login devuelve `{ accessToken, refreshToken, expiresIn: 900 }`.
- El **access token dura 15 minutos**. Firmado RS256 por el user-service.
- El **refresh token** es opaco, dura 30 días y **rota en cada uso**: cada `POST /auth/refresh` devuelve un refresh nuevo y el anterior queda revocado. Si se reutiliza un refresh ya usado, el backend revoca toda la cadena (se asume robo) y hay que volver a iniciar sesión.
- `POST /auth/logout` revoca el refresh actual.

Claims del token base que le interesan a la app:

| Claim | Uso en la app |
|---|---|
| `sub` | Id del usuario. Reemplaza el `userId` que hoy se saca del JWT y se guarda en localStorage |
| `email` | Email del usuario |
| `email_verified` | Tiene que ser `true` para aceptar invitaciones y reclamos |
| `ctx` | Siempre `USER` en la app |
| `exp` | Vencimiento (15 min) |

### 3.2 Qué hay que cambiar en el `AuthInterceptor`

1. Guardar `accessToken` y `refreshToken`.
2. Ante un `401`, llamar a `POST /auth/refresh` **una sola vez**, guardar el par nuevo y reintentar la petición original.
3. Si varias peticiones fallan a la vez, que compartan un único refresh en curso (si cada una refresca por su lado, la rotación invalida a las demás).
4. Si el refresh falla → limpiar sesión y mandar a `/login`.

### 3.3 La identidad sale del token (PETS-02, USER-07)

Desaparecen `userId` y `ownerId` de bodies y query params. Cambios concretos en Pets:

| Hoy | Después |
|---|---|
| `ownerId` en `AddPet`, `EditPet`, borrar mascota | se quita |
| `?ownerId=` al subir foto | se quita |
| `ownerId` en dar acceso, cambiar rol, revocar acceso | se quita |
| `ownerId` en enviar o reenviar invitación y en invitaciones pendientes por mascota | se quita |
| `userId` en el body de aceptar invitación | se quita |
| invitaciones pendientes por email con `{ email }` en el body | `GET` sin body, usa el email del token |
| `uploadedBy` al subir documento | se quita |
| `GET /pets/user/{userId}` | `GET /pets/me` |
| `GET /pets/shared?userId=` | `GET /pets/shared/me` |

Además, aceptar una invitación de perfil compartido exige que el email del token sea el mismo de la invitación (si no → `403`).

`POST /auth/context/user` devuelve un token base nuevo; la app solo lo necesita si algún día un mismo usuario entra también como empleado de clínica.

---

## 4. Directorio de veterinarias

Endpoints **públicos** (no requieren token). Solo aparecen clínicas `ACTIVE` con `directory_visible = true`.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/public/veterinaries` | Buscar. Parámetros: `q`, `city`, `lat`, `lng`, `radiusKm`, paginado |
| GET | `/public/veterinaries/{id}` | Perfil público (sin NIT ni datos internos) |
| GET | `/public/veterinaries/{id}/services` | Servicios activos que se pueden reservar en línea |
| GET | `/public/veterinaries/by-code/{code}` | Vista previa de la clínica antes de vincularse |

Datos de la clínica que existen en el backend (§7.3 V2) y que el perfil público puede mostrar: nombre, teléfono, dirección, ciudad, departamento, `latitude` / `longitude`, `logo_url`, `timezone`, `allow_online_booking`, `booking_requires_confirmation`, `cancellation_min_hours`. El contrato exacto de la respuesta todavía no está en el maestro: confirmarlo con el backend.

Servicio de la clínica (§7.3 V8): `id`, `name`, `category` (`CONSULTATION`, `VACCINATION`, `SURGERY`, `GROOMING`, `LAB`, `OTHER`), `durationMinutes`, `price`.

La búsqueda por distancia usa Haversine en SQL (VET-34). Encaja con `/maps`: se puede mostrar en el mismo mapa a las clínicas de MyAnimaLogVet junto a las de Google.

---

## 5. Vincularse a una clínica

| Método | Ruta | Token | Uso |
|---|---|---|---|
| GET | `/public/veterinaries/by-code/{code}` | público | Vista previa antes de confirmar |
| POST | `/veterinaries/link` | base | Vincularse. Body: `{ "code": "..." }`. Reemplaza `linkByCode` y `linkByUrl` |
| GET | `/me/linked-veterinaries` | base | Mis clínicas vinculadas |
| DELETE | `/veterinaries/{id}/link` | base | Desvincularme |

Reglas:

- La clínica tiene que estar `ACTIVE`.
- El código lo genera la clínica, y puede regenerarlo o revocarlo. El QR lleva ese mismo código.
- **Al desvincularse se revocan todas las mascotas de ese dueño en esa clínica.** Hay que avisarlo en la confirmación.
- La clínica también puede quitar al cliente desde su lado; el efecto es el mismo.

Flujo sugerido: escribir el código o escanear el QR → vista previa (logo, nombre, dirección) → "Vincularme" → ofrecer de una vez qué mascotas compartir.

---

## 6. Compartir y revocar mascotas

| Método | Ruta | Token | Uso |
|---|---|---|---|
| POST | `/veterinaries/{id}/patients/share` | base | Compartir. Body: `{ "petIds": ["..."] }` |
| DELETE | `/veterinaries/{id}/patients/{petId}/share` | base | Revocar el acceso de esa clínica a esa mascota |
| GET | `/me/pets/{petId}/veterinaries` | base | Qué clínicas ven esta mascota |

Reglas de compartir:

- El dueño tiene que estar vinculado a la clínica.
- **Todo o nada:** si algún `petId` no es suyo → `403` y no se comparte ninguno. En la app, ofrecer solo mascotas propias (rol `OWNER`; no las que le compartieron como `EDITOR` o `VIEWER`).
- Si la mascota ya había sido revocada, compartirla de nuevo la reactiva.
- Puede fallar por el límite de pacientes del plan de la clínica (`max_patients`). Mostrar un mensaje claro.

Al revocar, la clínica deja de leer la historia de inmediato (los servicios cachean el permiso hasta 60 s).

Dónde mostrarlo: en el perfil de cada mascota, una sección "Clínicas con acceso" con `GET /me/pets/{petId}/veterinaries` y un botón para revocar.

---

## 7. Reclamar mascotas registradas por una clínica

Caso: el dueño no tenía la app, la clínica registró a la mascota con sus datos de contacto y le mandó una invitación por correo. Al reclamarla, la mascota pasa a su cuenta.

| Método | Ruta | Token | Uso |
|---|---|---|---|
| GET | `/pets/claims/me` | base | Reclamos pendientes (por el email del token) |
| GET | `/pets/claims/{token}` | base | Vista previa: datos básicos de la mascota y nombre de la clínica |
| POST | `/pets/claims/{token}/accept` | base | Aceptar el reclamo |

Reglas de aceptar:

- La invitación tiene que estar `PENDING`, sin vencer (dura 30 días), y la mascota sin dueño (`UNCLAIMED`).
- El email del token tiene que ser el mismo de la invitación y estar verificado (`email_verified = true`).
- **Texto obligatorio en la app:** la clínica que registró la mascota **conserva el acceso**, y el dueño puede revocarlo desde la app.

Entrada al flujo:

- El correo trae un `claimUrl` con el token. La app tiene que abrir esa ruta (deep link o ruta web), por ejemplo `/claim/:token`. Si el usuario no ha iniciado sesión, pasar por login o registro y volver al reclamo.
- Además, mostrar los reclamos pendientes de `GET /pets/claims/me` en el Home o en notificaciones.

---

## 8. Citas

Las citas viven en Calendar (o en un módulo de Veterinary, según decidan en VET-30; los endpoints son los mismos).

| Método | Ruta | Uso |
|---|---|---|
| GET | `/public/veterinaries/{id}/services` | Elegir servicio |
| GET | `/veterinaries/{id}/availability?serviceId=&date=&employeeId=` | Franjas libres |
| POST | `/veterinaries/{id}/appointment-requests` | Pedir la cita |
| GET | `/me/appointments` | Mis citas en todas las clínicas |
| PATCH | `/veterinaries/{id}/appointments/{aid}/reschedule` | Reprogramar (revalida disponibilidad) |
| PATCH | `/veterinaries/{id}/appointments/{aid}/cancel` | Cancelar |

Respuesta de disponibilidad: `[{ startsAt, endsAt, employeeId, employeeName }]`, en la zona horaria de la clínica. No incluye franjas pasadas ni con menos de 1 hora de anticipación.

Reglas para el dueño:

- Solo citas de **sus** mascotas, en clínicas `ACTIVE` con `allowOnlineBooking = true`, y la mascota tiene que estar compartida con esa clínica. Si no lo está, ofrecer compartirla antes de pedir la cita.
- Una cita pedida desde la app nace `REQUESTED` si la clínica exige confirmación (`bookingRequiresConfirmation`), si no, nace `CONFIRMED`.
- Solo se puede cancelar con al menos `cancellationMinHours` de anticipación (por defecto 4 h). Fuera de plazo el backend da error: deshabilitar el botón y explicarlo.
- El precio, el nombre y la duración del servicio se guardan en la cita: si la clínica cambia el precio después, la cita conserva el original.

Estados de la cita:

```
REQUESTED ──confirm──▶ CONFIRMED ──check-in──▶ CHECKED_IN ──complete──▶ COMPLETED
    │                     │    └──no-show──▶ NO_SHOW
    └──reject──▶ REJECTED └──cancel──▶ CANCELLED (también desde REQUESTED)
```

Sugerencia de textos: `REQUESTED` "Pendiente de confirmación", `CONFIRMED` "Confirmada", `CHECKED_IN` "En la clínica", `COMPLETED` "Atendida", `CANCELLED` "Cancelada", `NO_SHOW` "No asististe", `REJECTED` "Rechazada".

Relación con lo que ya existe: hoy `CalendarService` maneja eventos propios del dueño (`VET_APPOINTMENT`, etc.). Las citas reales con clínicas vienen de `GET /me/appointments`; conviene mostrarlas en el mismo calendario, diferenciadas de los eventos manuales.

---

## 9. Historia clínica: qué puede hacer el dueño (MED-03)

Con token base, el dueño de la mascota:

| Acción | Dueño |
|---|---|
| Ver visitas, tratamientos, cirugías, laboratorios, vacunas, peso | ✅ |
| Crear o editar visitas, tratamientos, medicación, cirugías, laboratorios | ❌ 403 |
| Crear o editar vacunas | ❌ 403 |
| Registrar peso | ✅ (queda con `Source = OWNER`) |
| Borrar cirugías | ❌ |

Impacto en la app: cuando el backend despliegue MED-03, los formularios con los que hoy el dueño registra visitas o vacunas van a dar `403`. Hay que decidir con el equipo cómo queda eso en la app (ocultar los botones, o dejarlo como registro propio si el backend lo permite). Los registros hechos por una clínica traen la clínica y el autor: se pueden mostrar como "Registrado por Clínica X".

---

## 10. Notificaciones que recibe el dueño

Todas llegan con el sobre común (`eventType`, `userId`, `recipient`, `payload`, `occurredAt`, `metadata`). `userId` es el destinatario.

| Evento | Canal | Texto | Payload |
|---|---|---|---|
| `USER_LINKED` | push | Te vinculaste a {veterinaryName} | veterinaryName |
| `USER_UNLINKED` | — | — | veterinaryName |
| `PET_SHARED_WITH_VETERINARY` | push | {veterinaryName} ya puede ver la historia de {petName} | petName, veterinaryName |
| `PET_SHARE_REVOKED` | — | — | petName, veterinaryName |
| `PET_CLAIM_INVITATION_SENT` | email | {veterinaryName} registró a {petName}: reclámalo en MyAnimaLog | claimUrl, expiresAt |
| `PET_CLAIMED` | push | {petName} ya es parte de tu cuenta | — |
| `APPOINTMENT_CONFIRMED` | email + push | Cita confirmada | veterinaryName, petName, startsAt, address |
| `APPOINTMENT_REJECTED` | — | — | — |
| `APPOINTMENT_RESCHEDULED` | email + push | Tu cita cambió de hora | oldStartsAt, startsAt |
| `APPOINTMENT_CANCELLED` | email + push | Cita cancelada | reason |
| `APPOINTMENT_REMINDER` | email + push | Recordatorio: mañana tienes cita | startsAt, address, phone |
| `APPOINTMENT_COMPLETED` | — | — | — |

Los eventos de cita siempre traen `veterinaryName`, `address`, `phone`, `petName`, `serviceName`, `startsAt` y `timezone`. "—" en canal o texto: el maestro no define plantilla todavía.

Las fechas se muestran en la zona horaria de la clínica (`payload.timezone`, por defecto `America/Bogota`). En la app, `NotificationService` (`/notifications`) tendrá que reconocer estos tipos y navegar a la pantalla que toca (cita, mascota, reclamo).

---

## 11. Convenciones HTTP y errores

- Formato de error: `{ "timestamp", "status", "error", "message" }`.
- `401` = token ausente, vencido o firma inválida → intentar refresh (§3.2).
- `403` = token válido pero sin permiso (mascota ajena, otra clínica, email que no coincide).
- `503` = un servicio interno no respondió. Mostrar "intenta de nuevo", no tratarlo como permiso denegado.
- Fechas en ISO-8601 UTC. Para mostrar, usar la zona de la clínica cuando aplique.
- Prefijos en el gateway, si se mantienen: `/api/users/**`, `/api/pets/**`, `/api/veterinary/**`, `/api/medical/**`, `/api/calendar/**`. Confirmar con el backend cómo quedan las rutas en `environment.apiUrl` antes de conectar.

---

## 12. Dependencias de backend y orden sugerido de pantallas

Antes de conectar cada pantalla, confirmar que su endpoint ya está desplegado en el gateway.

| Pantalla / cambio en la app | Depende de |
|---|---|
| Refresh token y migración de identidad (`/pets/me`, sin `userId`) | USER-01, USER-02, PETS-01, PETS-02 |
| Directorio y perfil público | VET-12, VET-31 (servicios), VET-34 (búsqueda por distancia) |
| Vincularse por código / QR, mis clínicas, desvincular | VET-26 (Fase 4) |
| Compartir / revocar, clínicas con acceso | VET-27 (Fase 4), PETS-04 |
| Reclamar mascota | PETS-05, PETS-06, VET-28 |
| Pedir y gestionar citas | VET-30…33 (Fase 5), CAL-01…06 |
| Historia clínica con permisos | MED-01, MED-03 |
| Notificaciones nuevas | NOTIF-01…03 |

Orden sugerido para el frontend (lo que se puede adelantar con datos de prueba mientras llega el backend):

1. Unificar la ruta Vet y crear la pantalla base con `SharedModule` y `app-tab-bar`.
2. Modelos (`Veterinary`, `VeterinaryService`, `Appointment`, `PetClaim`) y `VeterinaryService` con los endpoints de este documento.
3. Directorio + perfil público (se puede integrar con `/maps`).
4. Vincular por código / QR + "Mis veterinarias".
5. Compartir / revocar + "Clínicas con acceso" en el perfil de la mascota.
6. Reclamar mascota (ruta `/claim/:token` + pendientes en el Home).
7. Citas: servicio → fecha → franja → mascota → confirmar; lista "Mis citas".
8. Migración de auth cuando el backend la despliegue.

---

## 13. Recorrido de prueba de punta a punta (pasos del dueño)

Del criterio de "base técnica completa" (§7.15), los pasos que pasan por la app:

1. Una clínica registra a "Max", cuyo dueño (Carlos) no tiene la app, y le envía invitación para reclamarlo.
2. **Carlos instala la app, reclama a Max y ve que Clínica Patitas tiene acceso.**
3. **Otra dueña se vincula con el código QR, comparte a su gata y pide una cita desde la app.** La clínica la confirma.
4. La clínica atiende: marca la cita como atendida, registra la visita y aplica una vacuna.
5. **La dueña revoca el acceso de la clínica a su gata**; el veterinario ya no puede leer su historia.
