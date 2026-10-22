# MyAnimaLogVet ↔ Usuario — Contrato para el backend

> Documento para el equipo de backend. Explica **qué pantalla de Figma consume qué endpoint**, quién lo consume (app del dueño, panel de la clínica, otro servicio), qué respuesta necesita y qué reglas debe cumplir, en todo lo que conecta la parte veterinaria con el usuario (dueño de mascota).
> Fuentes cruzadas: Figma `e9FbM805Y2oAmOgIbcL0Hj` (frames del 13 oct), `MYANIMALOG_VET_MAESTRO.md` (plan), `GUIA_FRONTEND_VETERINARY.md` (13 oct, lo que existe hoy) y el código de este repo.
> Fecha: 14 de octubre de 2026.

## Índice

1. Cómo leer este documento
2. Quién es quién
3. App del dueño: flujos y contratos (A–H)
4. Panel de la clínica: lo que toca al dueño y a sus mascotas (I–L)
5. Endpoints internos entre servicios
6. Eventos y notificaciones
7. Catálogo de errores
8. Reglas transversales
9. Pedidos al backend (lo que el Figma muestra y el maestro no define)
10. Inconsistencias a resolver
11. Apéndice: matriz de endpoints y mapa pantalla → endpoint

---

## 1. Cómo leer este documento

### Leyenda de estado

| Marca | Significado |
|---|---|
| ✅ | **Existe** en el backend según la guía del 13 oct (terminado en local, **sin desplegar**) |
| 📋 | Está en el **maestro** (plan) pero aún no está construido |
| 🆕 | Lo **pide el diseño de Figma** y el maestro no lo define. El backend debe decidir o confirmar |

### Rutas

- Las rutas se escriben como en el maestro (la ruta objetivo), sin prefijo: `/public/veterinaries`.
- Detrás del gateway llevan prefijo por servicio: `/api/veterinary/**`, `/api/pets/**`, `/api/medical/**`, `/api/calendar/**`, `/api/auth/**`. **La app necesita que el backend confirme la ruta final de cada una** (hoy la guía usa `/api/veterinary/link/{vetId}/user/{userId}`, el maestro `/veterinaries/{id}/link`).
- Los contratos de respuesta marcados **(propuesto)** salen de lo que muestra el Figma. El maestro todavía no los define. Si el backend cambia un nombre de campo, avisar: la app normaliza `camelCase`/`snake_case` pero no inventa campos.

### Convenciones (del maestro §6)

- Token normal (`ctx: USER`) en la app del dueño. Token de clínica (`ctx: VETERINARY`, claims `vet_id`, `vet_role`, `employee_id`, `vet_licensed`, `vet_status`) en el panel.
- Si una ruta lleva `{veterinaryId}` y el token es de clínica, debe ser igual a `vet_id`; si no → `403`.
- Fechas ISO-8601 UTC. Hora local de la clínica según `timezone` (por defecto `America/Bogota`).
- Error: `{ timestamp, status, error, message }`. Se pide además un campo `code` estable (ver §7) para que la app decida el texto sin leer `message`.
- Hoy el login devuelve `{ token, refreshToken, expiresIn }`. El `userId` sale del claim `id` (no `sub`).

---

## 2. Quién es quién

### 2.1 Consumidores

| Consumidor | Qué es | Token | Qué hace con la parte Vet |
|---|---|---|---|
| **App del dueño** | MyAnimaLog (Ionic + Angular), este repo | Normal | Directorio, vincularse, compartir/revocar mascotas, reclamar, citas |
| **Panel de la clínica** | MyAnimaLogVet (web, aún sin repo; solo existe en Figma) | De clínica | Registro, pacientes, clientes, agenda, equipo, configuración, plan |
| **Admin de plataforma** | Mismo panel, sección aparte | Normal con `platform_role = PLATFORM_ADMIN` | Aprobar/suspender clínicas, revisar verificaciones |
| **Servicios internos** | user, pets, veterinary, medical, calendar, notifications, ia | `X-Internal-Api-Key` | Preguntar permisos, resolver datos, publicar eventos |

### 2.2 Qué servicio es dueño de qué dato

| Dato | Dueño | Quién lo pide |
|---|---|---|
| Cuenta, email, email verificado, tokens | User | Todos |
| Mascota, dueño, foto, documentos, reclamos | Pets | App, Veterinary, Medical |
| Clínica, código de invitación, vínculo dueño↔clínica, consentimiento por mascota, servicios, horarios, plan | Veterinary | App, panel, Calendar, Pets, Medical |
| Historia clínica (visitas, vacunas, peso…) | Medical | App, panel |
| Citas y disponibilidad | Calendar (o módulo de Veterinary, decisión VET-30) | App, panel |
| Notificaciones (envío y bandeja) | Notifications | App |

### 2.3 Quién llama a quién

```
App del dueño ──▶ Gateway ──▶ user      (login, refresh, verificar correo)
                          ├─▶ veterinary (directorio, vincular, compartir, clínicas con acceso)
                          ├─▶ pets       (mascotas propias, reclamos)
                          ├─▶ calendar   (disponibilidad, citas)
                          ├─▶ medical    (historia, con origen clínico)
                          └─▶ notifications (bandeja)

Panel clínica ──▶ Gateway ──▶ user (token de clínica) · veterinary · calendar · medical · pets

veterinary ──▶ pets (¿es dueño?, datos de mascota, crear mascota de clínica, invitación de reclamo)
veterinary ──▶ user (nombre/email/teléfono del dueño, batch)
pets · medical · calendar ──▶ veterinary (/internal/.../access: ¿esta clínica puede ver esta mascota?)
calendar ──▶ veterinary (/internal/.../schedule-rules) · pets (¿dueño de la mascota?)
user ──▶ veterinary (/internal/.../members/{userId}: emitir token de clínica)
todos ──▶ Pub/Sub ──▶ notifications
```

---

## 3. App del dueño: flujos y contratos

Todos con **token normal**, salvo los marcados *público*. Los IDs de Figma van entre paréntesis.

### A. Entrada a la parte Vet (`858:83`, `2031:225`)

La pestaña "Vet" abre `/vet`. Sin clínicas vinculadas muestra dos caminos: **"Tengo un código"** (flujo C) y **"Buscar clínicas"** (flujo B). Con clínicas muestra "Mis veterinarias" (flujo D).

| Necesita | Endpoint | Estado |
|---|---|---|
| Saber si hay clínicas vinculadas | `GET /me/linked-veterinaries` | 📋 |

### B. Directorio y perfil público (`2033:369`, `2033:447`)

*Público* (sin token). Solo clínicas `ACTIVE` y `directory_visible = true`.

| Endpoint | Para qué | Estado |
|---|---|---|
| `GET /public/veterinaries` | Lista y mapa | 📋 |
| `GET /public/veterinaries/{id}` | Perfil público | 📋 |
| `GET /public/veterinaries/{id}/services` | Servicios reservables en línea | 📋 |
| `GET /public/veterinaries/{id}/professionals?serviceId=` | Profesionales para elegir ("Cualquiera / Dra. Sara Ruiz") | 🆕 |
| `POST /public/veterinaries/batch` `{ ids }` | Nombre y logo de varias clínicas (historial médico, "clínicas con acceso") | 🆕 |

**Búsqueda** — parámetros: `q`, `city`, `lat`, `lng`, `radiusKm`, `hasOnlineBooking`, `serviceCategory` (los chips "Citas en la app" y "Vacunación"), `page`, `size`.

**Respuesta de la lista (propuesto)** — el Figma muestra por clínica: logo, nombre, distancia, barrio, abierto/cerrado y a qué hora, y "Consulta desde $45.000":

```json
{
  "items": [{
    "id": "uuid", "name": "Clínica Patitas", "logoUrl": "https://…",
    "verified": true,
    "address": "Cra. 3 #8-129, Bocagrande", "neighborhood": "Bocagrande", "city": "Cartagena",
    "latitude": 10.4, "longitude": -75.55, "distanceKm": 1.2,
    "openNow": true, "closesAt": "18:00", "nextOpensAt": null,
    "minConsultationPrice": 45000,
    "allowOnlineBooking": true
  }],
  "page": 0, "size": 20, "total": 3
}
```

- **"Ya estás vinculado"** (chip en la lista): la app lo resuelve cruzando con `GET /me/linked-veterinaries`. No hace falta que el endpoint público conozca al usuario.
- `openNow`, `closesAt`, `nextOpensAt` se calculan en el servidor con `business_hours`, `schedule_blocks` (festivos) y `timezone` de la clínica. La app no calcula horarios.
- `allowOnlineBooking` debe ser el valor **efectivo**: el ajuste de la clínica **y** que su plan incluya `ONLINE_BOOKING` (el plan FREE no lo incluye). Si no, la app ofrecería "Pedir cita" y la reserva fallaría.
- `neighborhood` no existe en el modelo de clínica del maestro (V2): se pide el campo o que el backend lo derive de `address`.

**Perfil público (propuesto)**: lo anterior más `phone`, `department`, `businessHours[]` (`dayOfWeek`, `opensAt`, `closesAt`), `bookingRequiresConfirmation`, `cancellationMinHours`, `timezone`. Sin NIT, sin datos legales, sin email interno.

**Servicios (propuesto)**: `{ id, name, category, durationMinutes, price, priceIsFrom }`. El Figma muestra "**Desde** $180.000" para Esterilización: hace falta `priceIsFrom` (boolean) o el equivalente. `category` ∈ `CONSULTATION | VACCINATION | SURGERY | GROOMING | LAB | OTHER`.

**Profesionales (propuesto)**: `[{ employeeId, displayName, role }]` solo de empleados activos que atienden ese servicio. **No** exponer email, teléfono ni licencia.

### C. Vincularse con código o QR (`2031:259`, `2031:295`, `2031:338`)

Flujo: escribir `VET-XXXXXXXX` o escanear QR → **vista previa** → "Vincularme" → pantalla de compartir mascotas (flujo E).

| Endpoint | Estado |
|---|---|
| `GET /public/veterinaries/by-code/{code}` (*público*) | 📋 |
| `POST /veterinaries/link` `{ "code": "VET-7K2M9QXA" }` | 📋 (hoy ✅ como `LinkByCode` / `LinkByUrl` separados, sin `userId` en el body) |

**Vista previa (propuesto)** — el Figma muestra logo, nombre, sello "Clínica verificada", dirección, horario en texto, teléfono, servicios en una línea y "Citas desde la app: Sí · la clínica las confirma":

```json
{
  "id": "uuid", "name": "Clínica Patitas", "logoUrl": "https://…", "verified": true,
  "address": "Cra. 3 #8-129, Bocagrande", "city": "Cartagena", "phone": "6056601234",
  "businessHours": [{ "dayOfWeek": 1, "opensAt": "08:00", "closesAt": "18:00" }],
  "serviceNames": ["Consulta general", "Vacunación", "Cirugía", "Laboratorio", "Peluquería"],
  "allowOnlineBooking": true, "bookingRequiresConfirmation": true
}
```

**Vincular — respuesta `201` (propuesto):** `{ "veterinary": { "id", "name", "logoUrl", "verified" }, "linkedAt": "…" }`.

**Errores que el Figma pinta con texto propio** (`2031:295`):

| Caso en pantalla | HTTP + `code` |
|---|---|
| "Esta clínica todavía no está disponible" (en revisión o suspendida) | `409 VETERINARY_NOT_ACTIVE` |
| "Código no válido" (revisa que empiece por VET- y tenga 8 letras o números) | `404 INVITE_CODE_NOT_FOUND` (también para revocado) |
| "Ya estás vinculado a Clínica Patitas — te llevamos para que compartas tus mascotas" | `409 ALREADY_LINKED` **con `veterinaryId` en el cuerpo**, para que la app navegue sin otra llamada |
| "No pudimos conectar" | Error de red o `503` |

**Reglas:** la clínica debe estar `ACTIVE`. El usuario sale del token. Un vínculo ya existente no se duplica. Publica `USER_LINKED` (§6).

**QR y enlace:** el maestro dice que el QR lleva el mismo código y que el enlace de invitación lleva el código dentro. La app necesita saber el **formato exacto del enlace** (por ejemplo `https://app.myanimalog.com/vet/link/{code}`) para abrirlo como deep link. Es el caso del panel "El dueño va a bajar la app: envía el enlace por WhatsApp o correo; al instalar se vincula con tu código" (`1961:219`). 🆕

### D. Mis veterinarias y detalle (`2032:227`, `2032:279`, `2032:342`)

| Endpoint | Para qué | Estado |
|---|---|---|
| `GET /me/linked-veterinaries` | Lista | 📋 (la guía dice que **no existe aún**) |
| `DELETE /veterinaries/{id}/link` | Desvincularme | 📋 (hoy ✅ como `DELETE /api/veterinary/link/{vetId}/user/{miUserId}`) |
| `GET /me/appointments?veterinaryId=` | Citas de esa clínica en el detalle | 🆕 (el filtro `veterinaryId`) |

**Lista (propuesto)** — cada tarjeta muestra clínica, "Ver a Juan" (mascotas que ve) y "Próxima cita":

```json
[{
  "veterinary": { "id": "uuid", "name": "Clínica Patitas", "logoUrl": "https://…", "verified": true,
                  "address": "Cra. 3 #8-129, Bocagrande", "city": "Cartagena", "phone": "6056601234",
                  "latitude": 10.4, "longitude": -75.55, "openNow": true, "closesAt": "18:00",
                  "allowOnlineBooking": true },
  "linkedAt": "2026-03-03T15:00:00Z",
  "sharedPets": [{ "petId": "uuid", "name": "Juan", "sharedAt": "2026-03-03T15:02:00Z" }],
  "nextAppointment": { "id": "uuid", "startsAt": "2026-10-16T15:00:00Z", "serviceName": "Vacunación",
                       "petName": "Juan", "employeeName": "Dra. Sara Ruiz", "status": "CONFIRMED" }
}]
```

- El detalle muestra una fila por **cada mascota propia** con interruptor (compartida o no). La app obtiene las mascotas del dueño de Pets y marca como compartidas las de `sharedPets`. Apagar el interruptor = `DELETE …/patients/{petId}/share`; encenderlo = `POST …/patients/share` (flujo E).
- "Cómo llegar" usa `latitude`/`longitude`; "Llamar" usa `phone`.

**Desvincularme** (hoja inferior `2032:342`). Texto de la app: *"La clínica dejará de ver a todas tus mascotas compartidas y **se cancelarán tus citas pendientes** con ella. Lo que la clínica ya registró se queda en la historia de tus mascotas."*
- Maestro (§7.1): revoca todas las mascotas del dueño en esa clínica. ✅ cubierto.
- **🆕 Cancelar también las citas pendientes** (`REQUESTED`, `CONFIRMED`) de ese dueño en esa clínica, con `cancelled_by = OWNER` y motivo `UNLINKED`. El maestro no lo dice.
- Respuesta `204`.

### E. Compartir y revocar mascotas (`2031:384`, `2032:416`, `2032:469`)

| Endpoint | Estado |
|---|---|
| `POST /veterinaries/{id}/patients/share` `{ "petIds": ["uuid"] }` | 📋 |
| `DELETE /veterinaries/{id}/patients/{petId}/share` | 📋 |
| `GET /me/pets/{petId}/veterinaries` | 📋 |

**Compartir** — pantalla "Compartir mascotas": lista "Tus mascotas" (seleccionables) y "A tu cuidado" (deshabilitadas: *"Es de Laura Gómez (eres editor). Solo su dueña puede compartirla con una clínica"*).
- La app solo ofrece mascotas donde el rol es `OWNER`, **pero el backend debe validarlo igual** con `PetsServicePort.isOwner`. Mascota que no es suya → `403 PET_NOT_OWNED` y **no se comparte ninguna** (todo o nada).
- Mascota con `REVOKED` previo se reactiva (`GRANTED`, nuevo `granted_at`).
- Respuesta `200 (propuesto)`: `{ "shared": [{ "petId", "status": "GRANTED", "grantedAt" }] }`.
- Errores: `403 PET_NOT_OWNED`, `404 NOT_LINKED` (el usuario no está vinculado a la clínica), `409 VETERINARY_NOT_ACTIVE`, `402 PLAN_LIMIT_REACHED` (`max_patients`; la app debe poder mostrar un mensaje claro).

**Revocar** — texto de la app: *"Dejará de ver su historia, vacunas y documentos en menos de un minuto. Sigues vinculado a la clínica y puedes volver a compartirlo"*. El "menos de un minuto" es la caché de 60 s del endpoint `access` (§8).
- Pone `consent_status = REVOKED`, `revoked_at = now`. Publica `PET_SHARE_REVOKED`. Respuesta `204`.
- **🆕 Las citas futuras de esa mascota en esa clínica se cancelan solas.** El panel lo muestra así en la ficha (`2030:225`: "Cita del 15 oct cancelada — se canceló sola al quitar el acceso"). El maestro no lo define.
- Lo que la clínica ya registró **no se borra** (el texto de la app lo promete).

**Clínicas con acceso** (pestaña del perfil de la mascota) — por cada clínica: logo, nombre, "Desde el 3 mar 2026 · la compartiste tú", "Última visita: 22 sep · Vacuna antirrábica":

```json
[{
  "veterinary": { "id": "uuid", "name": "Clínica Patitas", "logoUrl": "https://…" },
  "origin": "SHARED_BY_OWNER",
  "grantedAt": "2026-03-03T15:02:00Z",
  "grantedByMe": true
}]
```

- `origin`: `SHARED_BY_OWNER` | `REGISTERED_BY_CLINIC` (texto distinto: "la registró la clínica").
- **"Última visita" no vive en Veterinary** (Veterinary no guarda historia clínica). Decisión propuesta: la app la calcula pidiendo los registros a Medical y cruzando por `veterinary_id`. Eso exige que Medical devuelva `veterinaryId` en **todos** los registros (MED-02) y que exista `POST /public/veterinaries/batch` para los nombres. 🆕

### F. Reclamar una mascota registrada por una clínica (`2033:225`, `2033:256`)

Caso: la clínica registró a la mascota sin que el dueño tuviera la app y le envió un correo con `claimUrl`. La app abre `/claim/:token` (login primero si hace falta).

| Endpoint | Estado |
|---|---|
| `GET /pets/claims/me` | 📋 |
| `GET /pets/claims/{token}` | 📋 |
| `POST /pets/claims/{token}/accept` | 📋 |
| `POST /pets/claims/{token}/decline` | 🆕 (botón "No es mi mascota") |
| `POST /auth/verify-email/resend` | 🆕 (estado "Verifica tu correo primero — te enviamos un código") |

**Vista previa (propuesto)** — el Figma muestra mascota (nombre, especie, raza, sexo, edad), chips "Registrado el 7 oct 2026" y "1 consulta", clínica con sello, y el pie "Invitación para carlos.perez@correo.com · vence el 6 nov 2026":

```json
{
  "status": "PENDING",
  "pet": { "name": "Max", "species": "DOG", "breed": "Criollo", "sex": "MALE",
           "birthDate": "2021-05-10", "photoUrl": null },
  "registeredAt": "2026-10-07T14:00:00Z",
  "consultationsCount": 1,
  "veterinary": { "id": "uuid", "name": "Clínica Patitas", "city": "Cartagena", "neighborhood": "Bocagrande",
                  "verified": true, "phone": "6056601234", "logoUrl": "https://…" },
  "invitationEmail": "c***@correo.com",
  "expiresAt": "2026-11-06T14:00:00Z",
  "emailMatches": true,
  "emailVerified": true
}
```

- `status`: `PENDING | ACCEPTED | EXPIRED | CANCELLED`. Con `emailMatches` y `emailVerified` la app pinta **sin depender de errores** los cuatro estados de `2033:256`: aceptada ("Max ya es parte de tu cuenta"), correo distinto, correo sin verificar, vencida.
- `veterinary.phone` es necesario: el estado "vencida" ofrece **"Llamar a la clínica"**.
- `consultationsCount` viene de Medical; si es costoso, omitirlo y avisar (el diseño lo muestra como chip).
- ⚠️ **Privacidad:** el estado "correo distinto" del Figma muestra el correo completo de la invitación a alguien que tiene el enlace pero otra cuenta. Se propone **enmascararlo** (`c***@correo.com`) y ajustar el texto. Decisión del equipo (§10).

**Aceptar** (`POST /pets/claims/{token}/accept`, sin body): en una transacción `owner_id = sub`, `claim_status = CLAIMED`, se limpia `owner_contact_*`, invitación `ACCEPTED`. Publica `PET_CLAIMED`.

| Caso | HTTP + `code` |
|---|---|
| Correo del token ≠ correo de la invitación | `403 INVITATION_EMAIL_MISMATCH` |
| `email_verified = false` | `403 EMAIL_NOT_VERIFIED` |
| Invitación vencida (30 días) | `410 INVITATION_EXPIRED` |
| Mascota ya reclamada | `409 PET_ALREADY_CLAIMED` |
| Invitación cancelada (la clínica reenvió otra) | `410 INVITATION_CANCELLED` |

**Texto obligatorio en la app:** *"Clínica Patitas conserva el acceso a la historia de Max. Puedes quitárselo cuando quieras desde el perfil de Max, en 'Clínicas con acceso'."* El backend debe cumplirlo: tras aceptar, la mascota aparece en `GET /me/pets/{petId}/veterinaries` con `origin = REGISTERED_BY_CLINIC` y la clínica mantiene el acceso hasta que el dueño lo revoque.

**🆕 Reclamar vuelve "cliente" al dueño.** El panel muestra en Clientes la columna de vinculación con "Reclamó…" (`1964:219`). Para eso, al aceptar un reclamo Veterinary debe crear el vínculo dueño↔clínica (`link_origin = CLAIM`). Se propone que Veterinary consuma el evento `PET_CLAIMED` (hoy el maestro dice que no hace falta callback).

**"No es mi mascota"** (`decline`): marca la invitación como `DECLINED` y avisa a la clínica (evento nuevo `PET_CLAIM_DECLINED`, destinatario: quien registró). Si no se construye, el botón queda sin función.

**Verificar correo:** la app ya usa `POST /auth/verify-email { email, code }` (PIN). **No hay endpoint para reenviar el PIN**; el estado "Te enviamos un código" lo necesita.

**Pendientes en el Home** (`2033:281` — ver §10, ese frame no aparece en el archivo): `GET /pets/claims/me` devuelve por reclamo `{ claimToken, petName, veterinaryName, expiresAt }`; el `claimToken` es el que la app usa para abrir `/claim/:token`.

### G. Pedir cita (`2034:225`, `2034:282`, `2034:361`)

Tres pasos: **servicio → fecha y hora (y profesional) → mascota y confirmar**.

| Paso | Endpoint | Estado |
|---|---|---|
| 1 | `GET /public/veterinaries/{id}/services` | 📋 |
| 2 | `GET /veterinaries/{id}/availability?serviceId=&date=&employeeId=` | 📋 |
| 2 | `GET /public/veterinaries/{id}/professionals?serviceId=` | 🆕 |
| 3 | Mascotas propias (de Pets) y `GET /me/linked-veterinaries` para saber cuáles están compartidas | 📋 |
| 3 | `POST /veterinaries/{id}/patients/share` (si la mascota no está compartida) | 📋 |
| 3 | `POST /veterinaries/{id}/appointment-requests` | 📋 |

**Paso 2 — disponibilidad.** El Figma muestra una tira de **5 días** y las franjas del día elegido ("Horas libres el jueves 16 de oct"; días pasados o cerrados en gris).
- 🆕 El contrato actual acepta una sola `date`, lo que obliga a 5 llamadas por pantalla. Se pide `from` y `to` (máx. 14 días) y respuesta agrupada: `{ "days": [{ "date": "2026-10-16", "slots": [{ "startsAt", "endsAt", "employeeId", "employeeName" }] }] }`. Los días sin franjas llegan con `slots: []`.
- Zona horaria de la clínica. Sin franjas pasadas ni con menos de 1 hora de anticipación (el Figma lo dice: *"No mostramos horas con menos de 1 hora de anticipación"*).
- "Profesional: Cualquiera" = no se manda `employeeId`.
- ⚠️ **Riesgo de doble reserva:** el maestro permite `employee_id = null` ("cualquiera disponible"), pero la restricción `EXCLUDE … employee_id WITH =` **no protege filas con `employee_id` nulo** (los nulos nunca son iguales). Se pide que el backend **asigne siempre un empleado concreto al crear la cita**, aunque el dueño haya elegido "Cualquiera", y que cada franja de la respuesta traiga el `employeeId` que se asignaría.

**Paso 3 — pedir la cita.**

```json
POST /veterinaries/{id}/appointment-requests
{ "petId": "uuid", "serviceId": "uuid", "startsAt": "2026-10-16T15:00:00Z",
  "employeeId": "uuid-o-null", "notes": "Está un poco decaído desde ayer" }
```

Respuesta `201 (propuesto)` — la misma forma que cada elemento de `GET /me/appointments` (abajo).

| Caso | HTTP + `code` |
|---|---|
| La mascota no es del usuario | `403 PET_NOT_OWNED` |
| La mascota no está compartida con la clínica | `409 PET_NOT_SHARED` (la app ofrece "Compartir a Milor y continuar", comparte y reintenta) |
| Franja ocupada | `409 SLOT_TAKEN` (la app recarga las franjas) |
| Menos de 1 h de anticipación | `422 SLOT_TOO_SOON` |
| Clínica no activa / reservas apagadas / plan sin `ONLINE_BOOKING` | `409 VETERINARY_NOT_ACTIVE`, `409 ONLINE_BOOKING_DISABLED`, `402 FEATURE_NOT_IN_PLAN` |

- La cita nace `REQUESTED` si `bookingRequiresConfirmation`, si no `CONFIRMED`. Se copian `service_name`, `duration_minutes` y `price` (la app lo dice: *"El precio queda fijo en tu cita aunque la clínica lo cambie después"*).
- Publica `APPOINTMENT_REQUESTED` (destinatario: la clínica) y, si nace confirmada, `APPOINTMENT_CONFIRMED` (destinatario: el dueño).

### H. Mis citas y calendario

> El frame "Mis citas" que cita `MYANIMALOG_VET_BRECHAS.md` (`2034:426`) **no existe** en el archivo de Figma (ver §10). El contrato sale del maestro y de las pantallas de detalle.

| Endpoint | Estado |
|---|---|
| `GET /me/appointments?status=&from=&to=&veterinaryId=` | 📋 (+🆕 `veterinaryId`) |
| `PATCH /veterinaries/{id}/appointments/{aid}/cancel` | 📋 |
| `PATCH /veterinaries/{id}/appointments/{aid}/reschedule` | 📋 |

**Elemento de cita (propuesto):**

```json
{
  "id": "uuid", "status": "CONFIRMED", "origin": "APP",
  "veterinary": { "id": "uuid", "name": "Clínica Patitas", "address": "…", "phone": "…",
                  "latitude": 10.4, "longitude": -75.55, "timezone": "America/Bogota" },
  "pet": { "id": "uuid", "name": "Juan" },
  "service": { "id": "uuid", "name": "Vacunación", "durationMinutes": 15, "price": 35000 },
  "employee": { "id": "uuid", "name": "Dra. Sara Ruiz" },
  "startsAt": "2026-10-16T15:00:00Z", "endsAt": "2026-10-16T15:15:00Z",
  "notes": "…", "cancellableUntil": "2026-10-16T11:00:00Z", "cancellationReason": null
}
```

- 🆕 `cancellableUntil` (o `canCancel` boolean): la app **deshabilita el botón Cancelar** fuera de plazo y explica por qué, en vez de esperar el error. Debe calcularse con `cancellation_min_hours` de la clínica.
- Estados y textos: `REQUESTED` "Pendiente de confirmación", `CONFIRMED` "Confirmada", `CHECKED_IN` "En la clínica", `COMPLETED` "Atendida", `CANCELLED` "Cancelada", `NO_SHOW` "No asististe", `REJECTED` "Rechazada".
- Cancelar fuera de plazo → `409 CANCELLATION_WINDOW_CLOSED`.
- Las citas reales se muestran en el calendario de la app **separadas** de los eventos manuales (`/calendar-events`, tipo `VET_APPOINTMENT`). No se mezclan en el backend.

---

## 4. Panel de la clínica: lo que toca al dueño y a sus mascotas

Con **token de clínica**. Se incluye solo lo que conecta con el usuario; registro, equipo, plan y verificación están en el maestro.

### I. Entrar a una clínica y vincular al dueño desde recepción (`2035:225`, `1972:225`, `1961:219`)

| Endpoint | Para qué | Estado |
|---|---|---|
| `POST /auth/context/veterinary/{veterinaryId}` | Obtener token de clínica | ✅ |
| `POST /auth/context/user` | Volver a modo usuario | ✅ |
| `GET /me/veterinaries` (hoy `GET /api/veterinary/me`) | Selector "Elige tu clínica" | ✅ |
| `POST /veterinaries/{id}/invite-code` | Generar código | ✅ (confirmar ruta) |
| `DELETE /veterinaries/{id}/invite-code` | Revocar código | ✅ |

**Código de vinculación (Mi clínica)**: el Figma muestra el código, un QR descargable, "124 clientes", "Regenerar" y "Revocar código" (*"El código actual deja de servir. Los clientes ya vinculados se quedan"*). Revocar **no** desvincula a nadie.

**Se pide que `POST …/invite-code` devuelva** `{ "code", "inviteUrl", "createdAt" }` y que `GET` del código vigente exista para repintar la pantalla.

### J. Clientes (dueños vinculados) (`1964:219`, `1964:905`)

| Endpoint | Estado |
|---|---|
| `GET /veterinaries/{id}/clients?q=&filter=&page=&size=` | 📋 |
| `GET /veterinaries/{id}/clients/{userId}` | 🆕 (la ficha del cliente) |
| `DELETE /veterinaries/{id}/clients/{userId}` ("Quitar cliente") | 📋 (hoy ✅ como `DELETE /api/veterinary/link/{vetId}/user/{userId}`) |

**Lista (propuesto)** — columnas: cliente (nombre + correo), teléfono, mascotas compartidas (chips), fecha y origen del vínculo; pestañas "Todos 186", "Con cita próxima 23", "Vinculados este mes 12":

```json
{
  "items": [{
    "userId": "uuid", "fullName": "Carlos Mendoza", "email": "carlos.mendoza@correo.com", "phone": "3001234567",
    "linkedAt": "2026-03-03T15:00:00Z", "linkOrigin": "CODE",
    "sharedPets": [{ "petId": "uuid", "name": "Toby" }, { "petId": "uuid", "name": "Rocky" }],
    "hasUpcomingAppointment": true
  }],
  "counts": { "all": 186, "withUpcomingAppointment": 23, "linkedThisMonth": 12 },
  "page": 0, "size": 20, "total": 186
}
```

- `linkOrigin`: `CODE` (código o QR) | `CLAIM` (reclamó una mascota registrada por la clínica). 🆕 Se necesita la columna `link_origin` en `user_veterinary_links`.
- Nombre, correo y teléfono vienen de User por batch (`USER-06`). Solo datos de contacto, nunca datos de autenticación.
- **Privacidad:** una clínica solo ve a los dueños **vinculados a ella** y el correo/teléfono que el dueño aceptó compartir al vincularse. Un cliente `unlinked` desaparece de la lista.
- **Ficha del cliente** (`1964:905`): lo anterior más mascotas compartidas con estado de vacunas (`Al día`, `Por vencer`) y las citas del cliente (`Hoy 10:30 · Toby · Control posoperatorio · Dra. Sara Ruiz`, `22 sep · Atendida`). Las citas y el estado de vacunas vienen de Calendar y Medical; ver el modelo de lectura propuesto en §9, punto 7.
- "Quitar cliente" (*"La clínica pierde el acceso a todas sus mascotas"*): mismo efecto que desvincularse desde el lado del dueño, incluida la cascada de citas (🆕, flujo D) y el evento `USER_UNLINKED`. Requiere `CLINIC_CONFIGURE` (OWNER/ADMIN).

### K. Pacientes (`1958:174`, `1959:174`, `1961:219`, `1959:698`, `2030:225`, `2030:783`, `2030:1352`)

| Endpoint | Estado |
|---|---|
| `GET /veterinaries/{id}/patients?q=&species=&filter=&sort=&page=&size=` | 📋 |
| `GET /veterinaries/{id}/patients/{petId}` | 📋 |
| `POST /veterinaries/{id}/patients/walk-in` | 📋 |
| `POST /veterinaries/{id}/patients/{petId}/claim-invitation` ("Reenviar invitación") | 📋 |
| `PATCH /veterinaries/{id}/patients/{petId}` ("Editar datos", solo si sigue `UNCLAIMED`) | 🆕 |

**Tres caminos para agregar un paciente** (modal `1961:219`):

1. **El dueño tiene la app** (recomendado): el panel muestra el código/QR de la clínica; el dueño lo escanea y elige mascotas (flujos C y E). No hay endpoint de clínica.
2. **El dueño va a bajar la app**: la clínica envía el enlace de invitación por WhatsApp o correo; al instalar, el dueño queda vinculado (requiere el deep link, flujo C).
3. **El dueño no usará la app por ahora** (`1959:698`): registro sin app (`walk-in`).

**Registrar sin app — body (idéntico al maestro §7.3):**

```json
{
  "pet":   { "name": "Max", "species": "DOG", "breed": "Criollo", "sex": "MALE", "birthDate": "2021-05-10" },
  "owner": { "fullName": "Carlos Pérez", "phone": "+573001234567", "email": "carlos@correo.com",
             "documentType": "CC", "documentNumber": "1047123456" },
  "sendClaimInvitation": true
}
```

El Figma muestra el check *"Enviar al dueño una invitación para reclamar la mascota — le llega un correo y la invitación vence en 30 días. Cuando la reclame, la clínica conserva el acceso a su historia"*. Si la clínica no pone correo, `sendClaimInvitation` debe fallar con `400` o ignorarse con aviso (decisión del backend).

**Lista de pacientes — columnas del Figma:** paciente (nombre, especie · raza · edad), dueño (nombre + teléfono), última visita (fecha + tipo), próxima cita, **vacunas** (`Al día`, `Por vencer`, `Vencida`, `Sin registro`), **En la app** (`Conectado`, `Por reclamar`). Filtros con contador: `Vacunas vencidas`, `Por reclamar`, `Con cita hoy`; pestañas por especie con contador; orden "Última visita".

**Ficha del paciente — campos:** nombre, raza · sexo · edad · peso, chips de estado (`Vacunas al día`, `Conectado a la app` / `Por reclamar` + `Registrado por la clínica` / `Acceso revocado`), próxima cita, "Paciente desde…" y quién lo compartió o registró, microchip, esterilizado, dueño (nombre, teléfono, "Llamar"), **alerta clínica** (ej. "Alérgico a la penicilina"), historial reciente.

> La lista y la ficha mezclan datos de **cuatro** servicios (Veterinary, Pets, Medical, Calendar). El maestro dice que `veterinary_patients` guarda solo un snapshot (nombre de mascota y datos del dueño). Con 248 filas y filtros del lado del servidor ("vacunas vencidas", "con cita hoy"), la lista no puede armarse con llamadas por fila. Ver §9, punto 7.

**Estados de la ficha (13 oct):**

| Estado | Qué debe devolver `GET …/patients/{petId}` |
|---|---|
| Normal | Todo lo anterior. `consent.status = GRANTED` |
| **Acceso revocado** (`2030:225`) | `consent: { status: "REVOKED", grantedAt, revokedAt, revokedBy: "OWNER" }`, datos básicos (nombre, especie, raza, dueño y teléfono) y la lista de citas canceladas por la revocación. **Sin** historia, documentos, vacunas ni peso. "Registrar visita" deshabilitado |
| **Por reclamar** (`2030:783`) | `claim: { status: "UNCLAIMED", invitationEmail, invitationSentAt, invitationExpiresAt }`, `registeredBy: { name, role }` |
| **Asistente o veterinario sin tarjeta** (`2030:1352`) | El cliente decide los botones con `permissions` (ver §5, endpoint `access`): sin `CLINICAL_WRITE` no hay "Registrar visita"; con `NURSING_WRITE` sí hay aplicar vacuna y peso |

La respuesta debe incluir el arreglo `permissions` del empleado para esa mascota (el mismo del endpoint `access`), para que el panel no repita la matriz de roles.

**Reenviar invitación:** cancela las `PENDING` anteriores de esa mascota y crea una nueva con vencimiento de 30 días (PETS-06). Solo si `claim_status = UNCLAIMED`.

### L. Agenda (lo que ve y hace el dueño del otro lado)

La clínica confirma, rechaza, reprograma y cancela citas (`PATCH …/confirm|reject|reschedule|cancel`). Para el dueño el efecto es el evento correspondiente (§6) y el cambio de estado en `GET /me/appointments`. Reglas completas en el maestro §11 (CAL-03 a CAL-06); no se repiten aquí.

---

## 5. Endpoints internos entre servicios

Todos con `X-Internal-Api-Key`, timeout de 3 s, nunca expuestos por el gateway. Un fallo del servicio llamado → quien llama responde `503`, jamás "deja pasar".

| Endpoint | Lo llama | Lo atiende | Para qué | Estado |
|---|---|---|---|---|
| `GET /internal/veterinaries/{id}/patients/{petId}/access?userId=` | Pets, Medical, Calendar | Veterinary | ¿Esta clínica puede ver esta mascota? Devuelve `hasAccess`, `permissions`, `role`, `licensed` | 📋 (VET-29) |
| `GET /internal/veterinaries/{id}/members/{userId}` | User | Veterinary | Emitir token de clínica | 📋 (VET-11; la guía dice que el token de clínica ya funciona) |
| `GET /internal/veterinaries/{id}/summary` | Notifications, Calendar | Veterinary | Nombre, logo, teléfono, dirección, zona horaria | 📋 |
| `GET /internal/veterinaries/{id}/schedule-rules?from=&to=&employeeId=` | Calendar | Veterinary | Calcular disponibilidad | 📋 (VET-33) |
| `GET /internal/pets/{petId}/owner/{userId}` | Veterinary, Calendar, Medical | Pets | ¿Es dueño de la mascota? (todo o nada al compartir) | 📋 (PETS-04) |
| `POST /internal/pets/batch` `{ ids }` | Veterinary, Medical | Pets | Datos de varias mascotas, `claimStatus`, `ownerId` | 📋 (PETS-04) |
| `POST /internal/pets/clinic` | Veterinary | Pets | Crear mascota de clínica (sin dueño) | 📋 (PETS-05) |
| `DELETE /internal/pets/clinic/{petId}` | Veterinary | Pets | Compensación si falla el registro | 📋 (PETS-05) |
| `PATCH /internal/pets/clinic/{petId}` | Veterinary | Pets | Editar datos mientras `UNCLAIMED` | 📋 (PETS-05) |
| `POST /internal/pets/{petId}/claim-invitations` | Veterinary | Pets | Crear o reenviar invitación | 📋 (PETS-06) |
| `GET /internal/users/{id}`, `POST /internal/users/batch`, `GET /internal/users/by-email` | Veterinary | User | Nombre, correo, teléfono, `emailVerified` | 📋 (USER-06) |

**Respuesta de `access` (contrato del maestro, no cambia):**

```json
{ "hasAccess": true, "veterinaryStatus": "ACTIVE", "employeeId": "uuid", "role": "VETERINARIAN",
  "licensed": true, "permissions": ["CLINICAL_READ", "CLINICAL_WRITE", "NURSING_WRITE", "DOCUMENT_UPLOAD", "APPOINTMENT_MANAGE", "PATIENT_REGISTER"] }
```

`hasAccess = false` si: no es empleado activo, la clínica no está `ACTIVE`, o el consentimiento de la mascota está `REVOKED`/inexistente. Los consumidores cachean 60 s por `(veterinaryId, petId, userId)`.

---

## 6. Eventos y notificaciones

Sobre único (maestro §6.4): `{ eventType, userId, recipient, payload, occurredAt, metadata }`. `userId` = **a quién se notifica**. Un fallo al publicar nunca tumba la respuesta HTTP.

### 6.1 Eventos que recibe el dueño

| Evento | Quién lo publica | Cuándo | Payload mínimo |
|---|---|---|---|
| `USER_LINKED` | Veterinary | Al vincularse | `veterinaryId`, `veterinaryName` |
| `USER_UNLINKED` | Veterinary | Al desvincularse (cualquier lado) | `veterinaryId`, `veterinaryName` |
| `PET_SHARED_WITH_VETERINARY` | Veterinary | Al compartir | `petId`, `petName`, `veterinaryId`, `veterinaryName` |
| `PET_SHARE_REVOKED` | Veterinary | Al revocar | ídem |
| `PET_CLAIM_INVITATION_SENT` | Pets | Invitación de reclamo (a un dueño **sin cuenta**: `userId = null`, `recipient.email`) | `petName`, `veterinaryName`, `claimUrl`, `expiresAt` |
| `PET_CLAIMED` | Pets | Reclamo aceptado | `petId`, `petName`, `veterinaryId` |
| `APPOINTMENT_CONFIRMED`, `_REJECTED`, `_RESCHEDULED`, `_CANCELLED`, `_REMINDER`, `_COMPLETED` | Calendar | Cambios de estado | `appointmentId`, `veterinaryId`, `veterinaryName`, `address`, `phone`, `petId`, `petName`, `serviceName`, `startsAt`, `timezone` (+ `oldStartsAt` o `reason` según el caso) |

### 6.2 Eventos que reciben la clínica o terceros por culpa del dueño

| Evento | Destinatario | Cuándo |
|---|---|---|
| `APPOINTMENT_REQUESTED` | La clínica (`recipient.email` o empleado responsable) | El dueño pide cita |
| `APPOINTMENT_CANCELLED` | La clínica | El dueño cancela, **o** se cancela por desvincular o por revocar (🆕 `reason = UNLINKED \| ACCESS_REVOKED`) |
| `PET_CLAIM_DECLINED` 🆕 | Quien registró la mascota | El dueño pulsa "No es mi mascota" |
| `PET_CLAIMED` | La clínica que la registró | Para que el panel pase la mascota a "Conectado a la app" |

### 6.3 Lo que falta para que la app muestre estas notificaciones

La bandeja de la app (`GET /notifications?userId=&read=`) devuelve `{ id, userId, title, message, type, read, sendAt, createdAt, updatedAt }`. Dos problemas para la parte Vet:

1. **`type` solo admite** `GENERAL | PET_INVITATION | SHARED_ACCESS | MEDICAL | VACCINE_DUE | VETERINARY_ALERT`. Hace falta definir cómo se mapean los eventos nuevos (`USER_LINKED`, `PET_CLAIMED`, `APPOINTMENT_*`…) a un `type`, o ampliar el enum. Propuesta mínima: agregar `VETERINARY_LINK`, `PET_CLAIM`, `APPOINTMENT`.
2. **No hay campo con datos para navegar.** La app necesita saber a qué pantalla ir al tocar una notificación (cita, mascota, reclamo). Se pide agregar `data` (objeto) con los ids relevantes: `{ "appointmentId", "petId", "veterinaryId", "claimToken" }`. 🆕

Plantillas y canales (email/push): ver maestro §12 (NOTIF-03). El dueño recibe push en `USER_LINKED`, `PET_SHARED_WITH_VETERINARY`, `PET_CLAIMED`, `APPOINTMENT_*`; email en `PET_CLAIM_INVITATION_SENT` y `APPOINTMENT_*`. `USER_UNLINKED`, `PET_SHARE_REVOKED`, `APPOINTMENT_REJECTED` y `APPOINTMENT_COMPLETED` **no tienen plantilla definida**.

---

## 7. Catálogo de errores

Se pide que todo error de la parte Vet traiga `code` estable además de `message`. La app decide el texto por `code`.

| HTTP | `code` | Dónde |
|---|---|---|
| 401 | `TOKEN_EXPIRED`, `TOKEN_INVALID` | Todos (la app intenta refresh una vez) |
| 401 | `VETERINARY_MEMBERSHIP_REVOKED` | Refresh de token de clínica ✅ |
| 403 | `NOT_A_VETERINARY_MEMBER`, `VETERINARY_REJECTED` | Token de clínica ✅ |
| 403 | `TENANT_MISMATCH`, `INSUFFICIENT_PERMISSION` | Panel |
| 403 | `PET_NOT_OWNED` | Compartir, pedir cita |
| 403 | `INVITATION_EMAIL_MISMATCH`, `EMAIL_NOT_VERIFIED` | Reclamar, aceptar invitaciones |
| 404 | `INVITE_CODE_NOT_FOUND`, `NOT_LINKED` | Vincular, compartir |
| 409 | `VETERINARY_NOT_ACTIVE`, `ALREADY_LINKED` (con `veterinaryId`) | Vincular, compartir, citas |
| 409 | `PET_NOT_SHARED`, `SLOT_TAKEN`, `ONLINE_BOOKING_DISABLED`, `PET_ALREADY_CLAIMED`, `CANCELLATION_WINDOW_CLOSED` | Citas, reclamar |
| 410 | `INVITATION_EXPIRED`, `INVITATION_CANCELLED` | Reclamar |
| 402 | `PLAN_LIMIT_REACHED`, `FEATURE_NOT_IN_PLAN` | Compartir, pedir cita |
| 422 | `SLOT_TOO_SOON` | Pedir cita |
| 503 | `EXTERNAL_SERVICE_UNAVAILABLE` | Cualquier llamada que dependa de otro servicio. La app muestra "intenta de nuevo", **no** "sin permiso" |

---

## 8. Reglas transversales

1. **La historia es del dueño.** La clínica solo ve las mascotas con `consent_status = GRANTED`. Revocar o desvincular corta el acceso de lectura; **no borra** lo que la clínica ya registró.
2. **Caché de 60 s.** Pets, Medical y Calendar cachean `access` 60 s. La app promete "en menos de un minuto"; no subir ese tiempo.
3. **Cascadas al quitar acceso** (🆕, el maestro solo cubre la primera):
   - Desvincular (dueño o clínica) → revoca todas las mascotas de ese dueño en esa clínica **y cancela sus citas pendientes** con ella.
   - Revocar una mascota → **cancela las citas futuras** de esa mascota con esa clínica.
4. **Identidad desde el token.** Hoy muchos POST/PUT de la app mandan `userId`/`ownerId` en el body o la query. Cuando Pets despliegue PETS-02, la app los quita y pasa `GET /pets/user/{id}` a `/pets/me`. **Coordinar la fecha** con la app para no romper ninguna de las dos versiones.
5. **Un solo vínculo activo por (dueño, clínica).** `unlinked_at` marca el desvinculado; volver a vincularse crea o reactiva sin duplicar.
6. **Dueños sin app.** `owner_id` nulo en Pets (PETS-05) obliga a revisar todo código que asuma dueño no nulo (riesgo de `NullPointerException`).
7. **Datos de contacto del dueño** que ve la clínica: solo nombre, correo y teléfono, y solo mientras exista vínculo o la mascota esté compartida.

---

## 9. Pedidos al backend

Lo que el Figma muestra y ningún contrato cubre. Ordenados por impacto en la demo.

| # | Pedido | Por qué lo necesita el diseño | Servicio |
|---|---|---|---|
| 1 | `GET /me/linked-veterinaries` y `GET /public/veterinaries/by-code/{code}` adelantados | Sin ellos "Mis veterinarias" y la vista previa quedan con datos de prueba (la guía dice que no existen) | Veterinary |
| 2 | Código de error estable (`code`) en todos los errores | La app pinta textos distintos por caso (§7) | Todos |
| 3 | `ALREADY_LINKED` devuelve `veterinaryId` | El Figma lleva al dueño a la clínica ya vinculada | Veterinary |
| 4 | Cascada de citas al desvincular y al revocar | Texto del Figma: "se cancelarán tus citas pendientes" | Veterinary + Calendar |
| 5 | Reclamar crea el vínculo `link_origin = CLAIM` y Veterinary consume `PET_CLAIMED` | Clientes muestra "Reclamó…" | Veterinary + Pets |
| 6 | `POST /pets/claims/{token}/decline`, `POST /auth/verify-email/resend`, y `emailMatches` / `emailVerified` / `status` en la vista previa | Estados de `2033:256` y botón "No es mi mascota" | Pets + User |
| 7 | **Modelo de lectura para el panel**: `lastVisit`, `vaccineStatus`, `nextAppointment`, `claimStatus`, `alert` por paciente | Lista y ficha de Pacientes con filtros "Vacunas vencidas", "Con cita hoy" y contadores. Propuesta: alimentar `veterinary_patients` (o una tabla de lectura) con eventos `VISIT_COMPLETED`, `VACCINE_APPLIED`, `APPOINTMENT_*`, `PET_CLAIMED` | Veterinary |
| 8 | Disponibilidad con rango (`from`/`to`) y asignación de empleado concreto | Tira de 5 días; evitar doble reserva con `employee_id` nulo | Calendar |
| 9 | `GET /public/veterinaries/{id}/professionals` | Chips "Cualquiera / Dra. Sara Ruiz" | Veterinary |
| 10 | `openNow`, `closesAt`, `nextOpensAt`, `minConsultationPrice`, `distanceKm`, `neighborhood`, `priceIsFrom`, `allowOnlineBooking` efectivo | Tarjetas del directorio y perfil público | Veterinary |
| 11 | `cancellableUntil` y filtro `veterinaryId` en `/me/appointments` | Cancelar deshabilitado; citas por clínica en el detalle | Calendar |
| 12 | `inviteUrl` con formato fijo y deep link | "Enviar enlace por WhatsApp" que vincula al instalar | Veterinary |
| 13 | `POST /public/veterinaries/batch` y `veterinaryId` en **todos** los registros de Medical | "Última visita" por clínica; origen en el historial | Veterinary + Medical |
| 14 | `data` en las notificaciones y nuevos `type` | Navegar al tocar una notificación Vet (§6.3) | Notifications |
| 15 | `PATCH /veterinaries/{id}/patients/{petId}` (editar mascota sin reclamar) | Botón "Editar datos" en `2030:783` | Veterinary + Pets |
| 16 | Datos de ficha sin dueño hoy: **alertas clínicas/alergias**, microchip, esterilizado, frecuencia cardíaca y respiratoria, mucosas, condición corporal, anamnesis y examen separados, riesgo ASA, interpretación de laboratorio | Cabecera y pestañas de la historia clínica. La alergia es lo más visible de la ficha | Pets / Medical |
| 17 | Enmascarar el correo de la invitación en la vista previa | Privacidad (flujo F) | Pets |

---

## 10. Inconsistencias a resolver

1. **Tres formatos de código de clínica en el diseño.** App del dueño: `VET-7K2M9QXA` (8 caracteres, como dice la guía). Panel "Agregar paciente": `PATITAS-7Q4K`. Panel "Mi clínica": `PATI-7K2Q`. El backend genera `VET-XXXXXXXX`. Hay que decidir uno; la app valida `VET-` + 8 letras o números y rechazaría los otros dos. (Corrección de diseño pendiente.)
2. **Frames que `MYANIMALOG_VET_BRECHAS.md` cita y no existen en el archivo de Figma**, revisado el 14 oct: "Mis citas" (`2034:426`), "Historial médico con el origen de cada registro" (`2034:508`) y "Home con reclamo pendiente" (`2033:281`). El contrato de §3.H y §3.F sale del maestro, no de una pantalla.
3. **Rutas del maestro vs. la guía.** El maestro usa `/veterinaries/...`, `/me/...`, `/public/...`; la guía real usa `/api/veterinary/...`. Falta una tabla final de rutas del gateway.
4. **Login:** `CLIENTE.md` dice `accessToken`; el backend devuelve `token`. `expiresIn` 3600 (el maestro decía 900).
5. **Historial médico y permisos de escritura del dueño** (decisión del equipo, afecta a Medical): con MED-03 el dueño recibe `403` al crear visitas, vacunas, tratamientos, laboratorios o cirugías. Hoy la app tiene esos formularios. Opciones: (a) ocultarlos, (b) permitirlos como "Registrado por el dueño" (el backend tendría que permitirlo). El peso sí queda permitido con `Source = OWNER`.
6. **Dónde viven las alergias:** ¿Pets (el dueño también las edita) o Medical (dato clínico con autor)?
7. **¿El reclamo vuelve cliente al dueño?** El Figma lo asume ("Reclamó"); el maestro dice que no hace falta. Ver §9, punto 5.

---

## 11. Apéndice

### 11.1 Matriz de endpoints del dueño

| Método | Ruta | Consume | Token | Atiende | Estado |
|---|---|---|---|---|---|
| GET | `/public/veterinaries` | App | — | Veterinary | 📋 |
| GET | `/public/veterinaries/{id}` | App | — | Veterinary | 📋 |
| GET | `/public/veterinaries/{id}/services` | App | — | Veterinary | 📋 |
| GET | `/public/veterinaries/{id}/professionals` | App | — | Veterinary | 🆕 |
| GET | `/public/veterinaries/by-code/{code}` | App | — | Veterinary | 📋 |
| POST | `/public/veterinaries/batch` | App | — | Veterinary | 🆕 |
| POST | `/veterinaries/link` | App | Normal | Veterinary | 📋 (hoy ✅ LinkByCode/LinkByUrl) |
| GET | `/me/linked-veterinaries` | App | Normal | Veterinary | 📋 |
| DELETE | `/veterinaries/{id}/link` | App | Normal | Veterinary | 📋 (hoy ✅ `DELETE …/link/{vetId}/user/{userId}`) |
| POST | `/veterinaries/{id}/patients/share` | App | Normal | Veterinary | 📋 |
| DELETE | `/veterinaries/{id}/patients/{petId}/share` | App | Normal | Veterinary | 📋 |
| GET | `/me/pets/{petId}/veterinaries` | App | Normal | Veterinary | 📋 |
| GET | `/pets/claims/me` | App | Normal | Pets | 📋 |
| GET | `/pets/claims/{token}` | App | Normal | Pets | 📋 |
| POST | `/pets/claims/{token}/accept` | App | Normal | Pets | 📋 |
| POST | `/pets/claims/{token}/decline` | App | Normal | Pets | 🆕 |
| POST | `/auth/verify-email/resend` | App | — | User | 🆕 |
| GET | `/veterinaries/{id}/availability` | App, panel | Normal / clínica | Calendar | 📋 (+🆕 rango) |
| POST | `/veterinaries/{id}/appointment-requests` | App | Normal | Calendar | 📋 |
| GET | `/me/appointments` | App | Normal | Calendar | 📋 (+🆕 filtro) |
| PATCH | `/veterinaries/{id}/appointments/{aid}/cancel` | App, panel | Normal / clínica | Calendar | 📋 |
| PATCH | `/veterinaries/{id}/appointments/{aid}/reschedule` | App, panel | Normal / clínica | Calendar | 📋 |
| GET | `/notifications` | App | Normal | Notifications | ✅ (+🆕 `data`, `type`) |

### 11.2 Matriz de endpoints de la clínica ligados al usuario

| Método | Ruta | Consume | Permiso | Atiende | Estado |
|---|---|---|---|---|---|
| POST | `/auth/context/veterinary/{id}` | Panel | Normal | User | ✅ |
| POST | `/auth/context/user` | Panel | Cualquiera | User | ✅ |
| GET | `/me/veterinaries` (`/api/veterinary/me`) | Panel | Normal | Veterinary | ✅ |
| POST / DELETE | `/veterinaries/{id}/invite-code` | Panel | `CLINIC_CONFIGURE` | Veterinary | ✅ (generar: confirmar ruta) |
| GET | `/veterinaries/{id}/clients` | Panel | `CLINICAL_READ_BASIC` | Veterinary | 📋 |
| GET | `/veterinaries/{id}/clients/{userId}` | Panel | `CLINICAL_READ_BASIC` | Veterinary | 🆕 |
| DELETE | `/veterinaries/{id}/clients/{userId}` | Panel | `CLINIC_CONFIGURE` | Veterinary | 📋 (hoy ✅) |
| GET | `/veterinaries/{id}/patients` | Panel | `CLINICAL_READ_BASIC` | Veterinary | 📋 |
| GET | `/veterinaries/{id}/patients/{petId}` | Panel | `CLINICAL_READ_BASIC` | Veterinary | 📋 |
| POST | `/veterinaries/{id}/patients/walk-in` | Panel | `PATIENT_REGISTER` | Veterinary | 📋 |
| POST | `/veterinaries/{id}/patients/{petId}/claim-invitation` | Panel | `PATIENT_REGISTER` | Veterinary | 📋 |
| PATCH | `/veterinaries/{id}/patients/{petId}` | Panel | `PATIENT_REGISTER` | Veterinary | 🆕 |

### 11.3 Mapa pantalla de Figma → endpoint

Archivo `e9FbM805Y2oAmOgIbcL0Hj`, página única.

**App del dueño**

| Pantalla | Frame | Endpoints |
|---|---|---|
| Sin clínicas: dos caminos | `2031:225` (base `858:83`) | `GET /me/linked-veterinaries` |
| Vincular con código o QR | `2031:259` | `GET …/by-code/{code}` |
| Código: errores | `2031:295` | `POST /veterinaries/link` (errores §3.C) |
| Vista previa de la clínica | `2031:338` | `GET …/by-code/{code}`, `POST /veterinaries/link` |
| Elegir mascotas para compartir | `2031:384` | Mascotas de Pets, `POST …/patients/share` |
| Mis veterinarias | `2032:227` | `GET /me/linked-veterinaries` |
| Detalle de mi veterinaria | `2032:279` | `GET /me/linked-veterinaries`, `GET /me/appointments?veterinaryId=`, `POST`/`DELETE …/share` |
| Desvincularme: confirmación | `2032:342` | `DELETE …/link` |
| Pet profile · Clínicas con acceso | `2032:416` | `GET /me/pets/{petId}/veterinaries`, Medical |
| Pet profile · Quitar acceso | `2032:469` | `DELETE …/patients/{petId}/share` |
| Reclamar mascota | `2033:225` | `GET /pets/claims/{token}`, `POST …/accept`, `POST …/decline` |
| Reclamar: estados | `2033:256` | `GET /pets/claims/{token}`, `POST /auth/verify-email/resend` |
| Directorio de clínicas | `2033:369` | `GET /public/veterinaries`, `GET /me/linked-veterinaries` |
| Perfil público de la clínica | `2033:447` | `GET /public/veterinaries/{id}`, `…/services` |
| Pedir cita 1: servicio | `2034:225` | `GET …/services` |
| Pedir cita 2: fecha y hora | `2034:282` | `GET …/availability`, `GET …/professionals` |
| Pedir cita 3: mascota y confirmar | `2034:361` | `POST …/patients/share`, `POST …/appointment-requests` |

**Panel de la clínica (parte que toca al usuario)**

| Pantalla | Frame |
|---|---|
| Pacientes: lista | `1958:174` |
| Pacientes: ficha | `1959:174` |
| Pacientes: agregar paciente (QR, enlace, sin app) | `1961:219` |
| Pacientes: registrar sin app | `1959:698` |
| Ficha: acceso revocado | `2030:225` |
| Ficha: por reclamar | `2030:783` |
| Ficha: asistente o veterinario sin tarjeta | `2030:1352` |
| Clientes: lista | `1964:219` |
| Clientes: ficha del cliente | `1964:905` |
| Mi clínica (código y QR, reservas en línea, vista previa en la app) | `1972:225` |
| Elige tu clínica | `2035:225` |
| Historia clínica (Resumen, Consultas, Vacunas, Tratamientos, Cirugías, Laboratorio, Peso, Documentos, Recepción, Registrar visita, Sin historia) | `1997:225`, `1998:225`, `1998:710`, `2001:225`, `2001:747`, `2002:225`, `2002:719`, `2026:225`, `2027:225`, `2028:225`, `2029:225` |

> Los datos de ejemplo del diseño (Clínica Patitas, Carlos Mendoza, Toby, Max, NIT, fechas) son inventados.
