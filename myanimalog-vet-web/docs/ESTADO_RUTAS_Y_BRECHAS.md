# Rutas que funcionan, qué falta en cada lado y qué se le pide a backend

Al 25 de noviembre de 2026. Cruza las colecciones de Postman (Veterinary de 92 endpoints, Medical con V8 Documentos, Calendar), el código del panel (este repo)
y el de la app del dueño (`Frontend-MyAnimaLog`). Las pruebas contra Cloud Run del 25 nov fueron **sin token**: un `401` dice que la ruta está publicada, un `404` que el gateway no la conoce.

Leyenda: ✅ hecho y conectado · 🧪 hecho, falta probar con sesión real · ⛔ bloqueado por backend · ⬜ no hecho de nuestro lado.

## 1. Rutas: qué hay publicado (prueba del 25 nov)

| Servicio | Ruta | Sin token | Panel | Móvil |
|---|---|---|---|---|
| **Calendar** (`calendar-microservice-…run.app/api`) | Citas de la clínica: listar, crear, confirmar, rechazar, llegada, atendida, no asistió, cancelar, reprogramar | 401 | ✅ | — |
| | `GET /veterinaries/{id}/services` (servicios reservables, token de dueño) | 401 | ✅ | ✅ |
| | `POST /veterinaries/{id}/appointment-requests`, `GET /me/appointments`, cancelar/reprogramar del dueño | 401 | — | 🧪 |
| | `GET /veterinaries/{id}/availability` | 404 | ⛔ | ⛔ |
| | **CORS** | no manda `Access-Control-Allow-Origin` | ⛔ en web desplegada (local funciona con proxy) | ⛔ en web desplegada; el celular (Capacitor) no lo necesita |
| **Veterinary** (`/api/veterinary/**`) | login, registro, perfil, equipo, invitaciones, plan, QR, clientes, pacientes, admin | 401 | ✅ | — |
| | vincular, vista previa, mis clínicas, compartir/revocar | 401 | — | ✅ |
| | Fase 5: `/{id}/services` (CRUD), `/business-hours`, `/schedule-blocks`, `/employees/{id}/schedule` | 401 | 🧪 encendido | — |
| | `POST /{id}/patients/walk-in` (registrar sin app) | 401, pero con token da **500** y no está en la colección | ⛔ apagado (`patients`) | — |
| **Medical** (gateway `/api/…`) | visitas, peso, vacunas, tratamientos, medicamentos, cirugías, laboratorio, resumen clínico, esterilización | 401 | ✅ | ✅ |
| | `/api/allergies`, `/api/dewormings` | **404** | ⛔ | ⛔ (usa `medicalUrl` si se llena) |
| | `/api/documents` (V8, documentos de la mascota) | **404** | 🧪 hecho | — (solo veterinaria) |

## 2. Panel (este repo)

### Ya hecho

- Login, registro de clínica con documentos de verificación, admin, equipo e invitaciones, plan, código y QR de vinculación.
- Clientes y pacientes compartidos desde la app, ficha del paciente con **Ver historia médica**, **Registrar visita**, **Nueva cita** y **Subir documento**.
- Historia clínica: visitas, peso, vacunas, tratamientos con medicamentos, cirugías, laboratorio, resumen, alergias, desparasitación y esterilización.
- **Documentos de la mascota (V8):** subir (PDF/JPG/PNG ≤ 10 MB, tipo, título, consulta opcional), listar, abrir con URL firmada y borrar. También en la tarjeta de cada cirugía.
- Agenda conectada a Calendar: crear, confirmar, rechazar, llegada, atendida, no asistió, cancelar y reprogramar. "Nueva cita" con búsqueda de servicio, quién atiende y fecha/hora.
- Fase 5 encendida con el contrato de la colección: catálogo con `allowedRoles` y `requiresLicense`, horario de la clínica, horario por profesional (`usesClinicHours` o propio) y bloqueos en tramos de 92 días.
- Registrar paciente sin app y reenviar invitación: formulario y llamadas listos (dueño con tipo y número de documento), **apagados** hasta que exista el endpoint. La colección del 25 nov todavía no trae `walk-in`.
  - 26 nov: la colección nueva (`MyAnimaLogVet.postman_collection.json`, «92 endpoints, todos los del código», generada desde los controladores) **tampoco** trae `walk-in`, `claim-invitation` ni ningún otro POST para que la clínica cree una mascota. El servicio no lo tiene implementado: el botón sigue en «Pronto». Para encenderlo, el backend publica `POST /api/veterinary/{id}/patients/walk-in` (contrato en `MYANIMALOG_VET_MAESTRO.md`, permiso `PATIENT_REGISTER`) y el panel pasa `features.patients` a `true` en `environment.ts` y `environment.development.ts`.
  - 26 nov: nombre y teléfono del dueño usan las reglas del User service (`docs/NOMBRE_Y_TELEFONO.md`). El nombre completo tiene de 2 a 100 caracteres: letras, espacios, guion y apóstrofe. El teléfono se acepta como lo escribe la persona y se manda en E.164. `INVALID_PHONE` tiene su mensaje. La app del dueño ya pide los mismos datos al crear la cuenta.
- Las vistas llenan el ancho como en Figma.

### Falta

| # | Qué | Bloqueo |
|---|---|---|
| 1 | Probar con sesión real Fase 5 y Documentos; si dan 404/500, apagar el flag correspondiente | Prueba |
| 2 | **Corregir** visitas, peso, vacunas, medicamentos, cirugías y laboratorio con `/corrections` (motivo obligatorio); hoy solo tratamientos | Nuestro |
| 3 | Mostrar `cancellationReason` y `cancelledBy` en citas canceladas | Calendar no los manda |
| 4 | Horas libres reales al agendar (hoy se calculan en el panel y el servidor valida) | Falta `availability` |
| 5 | Registrar paciente sin app | Endpoint walk-in |
| 6 | Desplegar el panel | ✅ 27 nov: https://myanimalog-vet.web.app (sitio `myanimalog-vet`, `firebase deploy --only hosting` tras `ng build`). Falta que el gateway y Calendar permitan CORS desde ese dominio (hoy el preflight del gateway da 403) |

## 3. App del dueño (`Frontend-MyAnimaLog`)

### Ya hecho

- Vincular clínica por código (con o sin `VET-`) o QR, compartir y revocar mascotas, clínicas de la mascota.
- **Calendar:** pedir cita (desde la clínica y desde la asociación), Mis citas con cancelar y reprogramar, y las citas de la clínica (incluidas las que agenda el panel) en el calendario de la mascota.
- Notificaciones `APPOINTMENT_*`, `USER_LINKED`, `PET_CLAIMED` con navegación a Mis citas.
- Salud de la mascota (alergias, desparasitación, esterilización), correcciones de visitas, vacunas, tratamientos y cirugías.
- Home rediseñado; respuestas de la IA en tarjeta blanca.

### Falta

| # | Qué | Bloqueo |
|---|---|---|
| 1 | **Probar Calendar en el celular** (build nativo con Capacitor): pedir cita, verla en Mis citas, que el panel la confirme y que la cita agendada por el panel aparezca en el calendario | Prueba. En web desplegada no funciona hasta que Calendar mande CORS; con `ionic serve` va por el proxy |
| 2 | **Reclamar mascota** registrada por la clínica (`/pets/claims/*`, `/claim/:token`) | Nuestro, pero depende del walk-in |
| 3 | Editar laboratorio sigue con `PATCH /lab`: pasar a `/lab/{id}/corrections` | Nuestro |
| 4 | Mostrar el origen de cada registro ("Clínica X" o "Registrado por ti") y no dejar editar los de una clínica | Nuestro |
| 5 | Alergias y desparasitación | 404 en el gateway |

## 4. Cómo se complementan

| Flujo | Panel | Móvil | Estado |
|---|---|---|---|
| Dueño comparte mascota → clínica la ve | ✅ | ✅ | listo |
| Clínica agenda cita → dueño la ve | ✅ | ✅ | 🧪 probar en celular |
| Dueño pide cita → clínica confirma/rechaza → dueño se entera | ✅ | ✅ | 🧪 probar en celular |
| Clínica registra historia → dueño la ve | ✅ | ✅ | listo (salvo alergias/desparasitación: 404) |
| Clínica registra sin app → dueño reclama | listo y apagado | ⬜ | ⛔ walk-in |
| Documentos de la mascota | 🧪 | — | solo clínica; ⛔ 404 en el gateway |

## 5. Lo que se le pide a backend

1. **Publicar en el gateway** `/api/allergies`, `/api/dewormings` y `/api/documents` (los tres dan 404 sin token el 25 nov).
2. **CORS en Calendar** para el dominio del panel y de la app (`GET, POST, PATCH, PUT, DELETE`, cabecera `Authorization`).
3. **Registrar paciente sin app:** `POST /api/veterinary/{id}/patients/walk-in` (hoy 500, no está en la colección) y `POST …/patients/{petId}/claim-invitation`, con la forma de la respuesta, `claimStatus`/`ownerContact` en la lista y los errores.
4. **Confirmar el despliegue de Fase 5** (servicios, horarios, bloqueos, horario por profesional) con una clínica real.
5. **Enum de `documentType`:** la colección solo muestra `LABORATORIO`; el panel ofrece además `IMAGEN_DIAGNOSTICA`, `CONSENTIMIENTO`, `FORMULA`, `CERTIFICADO`, `VACUNAS`, `OTRO`.
6. **`GET …/availability`** o que Calendar lea el horario de Veterinary (hoy responde `409 SLOT_UNAVAILABLE` a horas fuera de su horario guía).
7. **Cita completa:** `cancellationReason` y `cancelledBy` en las citas.
8. Una clínica aprobada con servicios, empleados, una mascota compartida y una cita, para la prueba de punta a punta.

## 6. Cómo probar Calendar desde el celular

1. **Rápido (misma red wifi):** en `Frontend-MyAnimaLog`, `npx ionic serve --external` y abrir en el celular `http://<IP-del-PC>:8100`. Pasa por el proxy, así que no necesita CORS.
   **Nativo:** el proyecto todavía no tiene la plataforma Android. Hay que agregarla una vez (`npm i @capacitor/android@7` y `npx cap add android`), luego `npx ionic build --configuration production`, `npx cap sync android` y `npx cap run android`. Usa la URL completa de Calendar de `environment.prod.ts`.
2. Entrar con un dueño que tenga una mascota compartida con una clínica aprobada.
3. Pedir cita desde la clínica → en el panel aparece en "Solicitudes de la app" → confirmarla → en el celular cambia en Mis citas y llega el aviso.
4. Desde el panel agendar una cita a esa mascota → en el celular debe verse en el calendario de la mascota.
5. Si algo falla, en el panel copiar de Network el estado y el cuerpo (sin `authorization`); en el celular usar `chrome://inspect` para ver la consola.
