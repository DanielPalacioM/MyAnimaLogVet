# Cómo se adaptan a Vet los endpoints que ya usa MyAnimaLog

Los endpoints de la historia clínica ya existen: MyAnimaLog (la app del dueño) los usa hoy, y la colección `Medical-Pet-Backend` trae las mismas rutas con las
carpetas **D** (dueño) y **V** (veterinaria). Lo que cambia en Vet es **quién llama (token de clínica) y cómo se procesa el resultado**, no la ruta.
Este documento compara las dos apps y marca qué falta por adaptar en cada pantalla.

Fuentes: servicios de `Frontend-MyAnimaLog/src/app/services/*`, `Medical-Pet-Backend.postman_collection.json`, `MODULO_MEDICO.md`,
`MYANIMALOG_VET_BACKEND_CONTRATO.md`, y los frames de Figma `1941:174`, `1942:174` (Agenda) y `1964:219` (Clientes).

Leyenda: ✅ ya existe y se usa igual · 🔁 existe, se adapta (cambia el token, los campos o la forma de usarlo) · ❓ no lo encuentro en ninguna de las dos apps: hay que confirmar.

## 1. Cómo se llaman (cambia el token, no la ruta)

| | MyAnimaLog (dueño) | Vet (clínica) |
|---|---|---|
| Base | gateway `…/api` | el mismo: en desarrollo `/user-api/...` → gateway `/api/...` (ya está en `proxy.conf.cjs`) |
| Token | normal; muchos bodies llevan `userId` | **token de clínica** (`vet_id`, `employee_id`, rol, `licensed`). El interceptor ya lo manda en rutas que no son `/auth`, `/me`, `/register`, `/admin`… |
| Autor del registro | el dueño | sale del **token**, nunca del body (`veterinary_id`, empleado) |
| Permisos | `OWNER`/`EDITOR`/`VIEWER` por mascota | `CLINICAL_READ`, `CLINICAL_READ_BASIC`, `CLINICAL_WRITE`, `NURSING_WRITE`, `DOCUMENT_UPLOAD` (y 🔑 tarjeta verificada para escribir clínico) |
| Formato | mezcla camelCase y snake_case; algunas respuestas `{ success, data, count }` | igual: se normaliza en cada servicio (patrón `a.x ?? a.x_y`) |

Consecuencia práctica: en Vet los servicios van en `services/api/*.api.ts` con `${USER_API}/visits`, `${USER_API}/vaccines`, etc., sin mandar `userId`.

## 2. Mapa de endpoints: MyAnimaLog → Vet

| Dominio | Ruta (la misma) | MyAnimaLog hace | Vet hace | Estado |
|---|---|---|---|---|
| Visitas | `POST /visits` | el dueño la crea | la clínica registra la consulta con signos vitales, anamnesis, examen, plan y `appointmentId` | 🔁 campos extra (V1) |
| | `GET /visits/pet/{petId}` | historial de la mascota | pestaña Consultas y "Historial reciente" de la cita | ✅ |
| | `GET /visits/veterinary/{vetId}?from=&to=` | no existe | **visitas de mi clínica** en un rango | ✅ solo Vet (V1) |
| | `GET /visits/date-range` | por rango del dueño | no se usa | — |
| | `PUT /visits/{id}`, `GET /visits/{id}/treatment` | editar y ver tratamiento | editar solo las propias; ver tratamiento | 🔁 |
| Peso | `POST /weight`, `GET /weight?petId=&latest=`, `PATCH /weight` | el dueño pesa en casa (`source=OWNER`) | la clínica registra (`source=CLINIC` + rol del empleado); la gráfica separa series | 🔁 |
| Vacunas | `POST /vaccines`, `GET /vaccines?petId=`, `PUT /vaccines/{id}`, `GET /vaccines/{id}/due` | el dueño las anota | la clínica **aplica**: `lotNumber`, `manufacturer`, `nextDoseDate`, autor del token | 🔁 campos extra (V3) |
| Tratamientos | `/treatments`, `/treatments/{id}/add-medication`, `/treatments/{id}/is-active`, `/medications/{id}` | solo lectura para el dueño | veterinario con tarjeta recetan | 🔁 |
| Cirugías | `/surgery`, `/surgery/pet/{id}`, `/surgery/visit/{id}`, `PATCH`, `DELETE` | lectura | crear/editar; borrar solo la misma clínica | 🔁 |
| Laboratorio | `/lab?visit_id=`, `POST`, `PATCH` | lectura | crear y actualizar; filtro `isNormal` | 🔁 |
| Resumen clínico | `GET /pets/{petId}/clinical-summary` | no | ficha de paciente y **vista de recepción** (alergias, vacunas, tratamientos activos, último peso) | ✅ (V7) |
| Documentos | `/pets/{petId}/documents` (dueño) | sube y ve los suyos | `GET/POST/DELETE /documents` (solo veterinaria); eliminar solo los que subió la clínica | 🔁 |
| Mascota | `GET /pets/{id}`, `/pets/user/{ownerId}` | mi lista de mascotas | datos de la mascota en la ficha | ❓ ver §5 |
| Dueño | `GET /user/profile/{userId}` | perfil propio (ajeno da 403) | nombre y teléfono del dueño en cita y cliente | ❓ ver §5 |
| Calendario | `/calendar-events` (`VET_APPOINTMENT`, `MEDICATION`, `TREATMENT`, `GROOMING`, `OTHER`) | eventos **personales** del dueño, por usuario | no es la agenda de la clínica | ❓ ver §3 |
| Notificaciones | `/notifications` | avisos del dueño | no aplica al panel | — |
| Compartir / acceso | `/pets/{id}/access`, `/pets/shared`, `/pets/{id}/invitations` | **personas** con acceso (`OWNER/EDITOR/VIEWER`) | el acceso de la **clínica** es otro (vincular y compartir con clínica) | ❓ ver §4 |

## 3. Agenda: qué pide el Figma y de dónde sale cada dato

Frames `1941:174` (día) y `1942:174` (detalle de la cita).

| Elemento del Figma | Dato | Fuente posible | Estado |
|---|---|---|---|
| Título, flechas, **Hoy**, fecha, **Día / Semana** | solo interfaz | — | ✅ (ya está en la pantalla) |
| **Columnas por profesional** ("Dra. Sara Ruiz · Médica veterinaria · 3 citas", escudo de tarjeta verificada) | equipo y verificación | `GET /{id}/employees` + tarjeta profesional | ✅ |
| **Tarjetas de cita** (mascota, servicio, hora, estado, "Próxima") | citas de la clínica por día y profesional | `GET /visits/veterinary/{vetId}?from=&to=` da las **visitas**; **no** trae estado de cita (Por confirmar, Confirmada, En la clínica, No asistió) ni servicio ni duración | ❓ |
| **Puntos del mini calendario** | días con citas | mismo rango, agrupado por día | 🔁 depende de arriba |
| **Línea roja "ahora"**, bloques **Almuerzo** | hora actual y bloqueos del horario | horario y bloqueos de la clínica | ❓ |
| **Solicitudes de la app** (Aceptar / Rechazar) | el dueño pide cita a la clínica | en MyAnimaLog el dueño solo crea un **evento personal** (`/calendar-events`), que la clínica no recibe | ❓ |
| **Estados** (leyenda) | `REQUESTED/CONFIRMED/CHECKED_IN/COMPLETED/CANCELLED/NO_SHOW` | no aparecen en `visits` | ❓ |
| **Detalle: mascota** (raza, sexo, edad, peso) | ficha | `GET /pets/{id}` (edad: `/pets/{id}/age`) + peso `GET /weight?latest=true` | 🔁 si la clínica puede leerla |
| **Detalle: servicio** ("Control posoperatorio · 30 min · $45.000") | catálogo | no hay endpoint de catálogo | ❓ |
| **Detalle: dueño** (nombre, teléfono, **Llamar**) | contacto | `GET /user/profile/{id}` (ajeno da 403 con token normal) | ❓ |
| **"Comparte la historia de Toby con la clínica"** | acceso compartido | estado del acceso de la clínica | ❓ |
| **Nota del dueño al pedir la cita** | texto | parte de la solicitud | ❓ |
| **Historial reciente** ("22 sep · Esterilización · Dra. Sara Ruiz") | visitas y vacunas | `GET /visits/pet/{id}` + `GET /vaccines?petId=` | ✅ |
| **Marcar llegada, Reprogramar, No asistió, Cancelar cita** | cambios de estado | no hay transiciones de cita | ❓ |
| **Atendida → "Registrar visita"** | crea la consulta con `appointmentId` | `POST /visits` | ✅ (la visita se crea **después** de marcarla atendida; una por cita) |

Lectura: lo **clínico** del detalle (historial, peso, vacunas, registrar la visita) ya se cubre con los endpoints compartidos. Lo que no tiene equivalente es la **cita como
objeto de la clínica** (estado, servicio, duración, solicitud del dueño, bloqueos).

## 4. Clientes y Pacientes (frame `1964:219` y fichas)

| Elemento | Dato | Fuente posible | Estado |
|---|---|---|---|
| Contador "186 vinculados", pestañas Todos / Con cita próxima / Vinculados este mes | conteos | lista de clientes de la clínica | ❓ |
| Fila: nombre, correo, teléfono | contacto del dueño | `GET /user/profile/{id}` o la lista | ❓ |
| **Mascotas compartidas** (chips) | mascotas que el dueño compartió con **esta** clínica | `/pets/shared` es "a mi cuidado" (personas), no por clínica | ❓ |
| **Vinculado** (fecha y "Código QR" / "Reclamó a Luna") | origen del vínculo | vínculo dueño–clínica | ❓ |
| Última visita / **Próxima cita** | `GET /visits/pet/{id}` y citas | 🔁 y ❓ (citas) |
| **Mostrar código QR** | código de vinculación de la clínica | `POST/DELETE /{id}/invite-code` | ✅ |
| **Vincular** (lado dueño) | `POST /link/code`, `POST /link/url` | ✅ (Postman 11) |
| **Quitar cliente** | `DELETE /link/{vetId}/user/{userId}` | ✅ pero falta saber a quién |
| Ficha del cliente: mascotas con estado de vacunas | `GET /vaccines?petId=` + `/due` | 🔁 |
| Pacientes: lista, ficha, "Por reclamar", "Acceso revocado" | `GET /pets/{id}`, `clinical-summary` | ❓ la **lista** de pacientes de la clínica |

## 5. Lo que hay que confirmar con backend (cuatro preguntas)

1. **¿Con el token de clínica se puede leer `GET /pets/{id}`, `/pets/{id}/age` y `GET /user/profile/{id}` de una mascota/dueño que compartió con la clínica?**
   Hoy ver un perfil ajeno da `403`. Sin esto no hay raza, edad ni teléfono en la cita.
2. **¿Qué endpoint lista las mascotas y los dueños vinculados a una clínica?** (para Clientes y Pacientes). Los que usa MyAnimaLog son por dueño, no por clínica.
3. **¿Una "cita" de la clínica es un `visit` con estado, o un `calendar-event`?** El Figma pide estados (`CONFIRMED`, `CHECKED_IN`, `NO_SHOW`…), servicio y duración, y una
   visita no los tiene. Y el dueño, hoy, solo crea un evento suyo: la clínica no lo recibe.
4. **¿Dónde viven el catálogo de servicios, el horario y los bloqueos (Almuerzo)?** La Agenda los necesita para duración, precio y huecos.


## 6. Qué ya está conectado en el panel (8 de noviembre)

| Qué | Dónde | Estado |
|---|---|---|
| Capa de API de Medical con token de clínica y respuestas normalizadas | `services/api/medical.api.ts` | listo |
| **Historia clínica** `/pacientes/:petId/historia`: Resumen (con línea de tiempo), Consultas, Vacunas, Peso, Tratamientos, Cirugías y Laboratorio | `views/history/` | listo; muestra lo que llegue de Medical |
| Registrar visita, aplicar vacuna y registrar peso, según el rol (recepción solo ve el resumen) | `views/history/record.dialog.ts` | listo; el backend valida rol y tarjeta |
| El botón **Registrar visita** de la ficha de Pacientes abre esa historia (antes mostraba un aviso falso de éxito) | `patients.page.ts` | listo |

**Sin probar con datos reales.** Hace falta una cuenta de clínica aprobada con una mascota compartida: la pantalla se abre con el id de la mascota. Las formas exactas de las
respuestas de Medical (resumen clínico, laboratorio, tratamientos) no vienen en Postman: el panel acepta camelCase y snake_case y muestra lo que llegue.

### Agenda y servicios (19 de noviembre) — conectado al calendar-service y al catálogo

La colección **Calendar Microservice** responde la pregunta 3 de §5: la cita **no** es una `visit` ni un `calendar-event`; es su propio recurso en Calendar
(`/veterinaries/{id}/appointments`, estados `REQUESTED/CONFIRMED/CHECKED_IN/COMPLETED/CANCELLED/NO_SHOW`, origen `APP`/`CLINIC`, `employeeId`, `startsAt`/`endsAt`).

| Qué | Dónde | Estado |
|---|---|---|
| `GET …/appointments?from=&to=` (agenda por rango, mes visible con margen de una semana; se refresca cada minuto) | `services/api/calendar.api.ts`, `AgendaService` | 🟡 sin probar con token |
| Crear cita de la clínica (`POST`, nace `CONFIRMED`), confirmar, rechazar (**motivo obligatorio**), llegada, atendida, no asistió, cancelar, reprogramar | `ClinicStore.addAppointment/act/reschedule`, `reason.dialog.ts`, `new-appointment.dialog.ts` | 🟡 |
| La mascota de cada cita se cruza por `petId` con los pacientes compartidos (Pacientes) y el servicio por `serviceId` con el catálogo | `appointmentFrom` en `mappers.ts` | ✅ con pruebas |
| Catálogo: listar, crear, editar y desactivar (`/api/veterinary/{id}/services`). **No se borra**: "Eliminar" desactiva | `services/api/catalog.api.ts` | 🟡 la forma exacta de la respuesta no está en Postman; el mapper acepta camelCase y snake_case |
| Errores del servidor con mensaje en español (`SLOT_UNAVAILABLE`, `EMPLOYEE_NOT_ELIGIBLE`, `TENANT_MISMATCH`…) | `api-error.ts` | ✅ |

**Dónde vive Calendar (verificado el 18 nov).** Es un servicio **aparte** en Cloud Run, no pasa por el gateway: `https://calendar-microservice-20369076707.us-central1.run.app/api`.
Sin token responde `401 MISSING_TOKEN` en `/veterinaries/{id}/appointments` y `/me/appointments` (las rutas existen); en el gateway esas mismas rutas dan 404.
`calendarApiUrl` (entorno) incluye `/api`: en desarrollo es `/calendar-api` y `proxy.conf.cjs` lo manda a ese servicio; para el Calendar local:
`CALENDAR_TARGET=http://localhost:3000 npm start`.

**Dos cosas que siguen abiertas con Calendar:**
1. **CORS.** El servicio no manda cabeceras `Access-Control-Allow-*` (el preflight `OPTIONS` responde 204 sin ellas). En desarrollo no importa (el proxy llama de servidor a servidor);
   **desplegado, el navegador bloqueará las llamadas.** Hay que permitir el origen del panel en Calendar o servirlo detrás del mismo dominio.
2. **Disponibilidad.** `GET …/availability` no existe en Calendar (devuelve la página 404 de Next). El panel calcula las horas libres con las citas cargadas y el servidor valida (`SLOT_UNAVAILABLE`).
   La colección también deja ver que el servidor corre con datos simulados (`SIM_*`): servicios y empleados de prueba. Mientras Calendar no lea el catálogo y el equipo reales de Veterinary,
   una cita creada con un servicio o empleado reales puede responder `EMPLOYEE_NOT_ELIGIBLE` o 404.

**Horario y bloqueos (conectados con la forma del maestro §8, sin probar):** `GET/PUT /api/veterinary/{id}/business-hours` (`dayOfWeek` 1 = lunes, `opensAt`/`closesAt`; el PUT manda `{ businessHours: [...] }`)
y `GET/POST/DELETE …/schedule-blocks` (`employeeId` nulo = toda la clínica, `startsAt`/`endsAt`, `reason`). La forma exacta del PUT y del POST no está en Postman: si falla, el panel muestra el error del servidor.
Sigue sin conectar el horario **por profesional** (`/employees/{id}/schedule`).

Se quitó "Llamar" y el teléfono del dueño en Agenda, Clientes y Pacientes: no es parte del producto.

## 7. Verificación contra el gateway (sin token)

`GET https://pets-api-gateway-…/api/<ruta>`: **401** = la ruta existe y pide sesión, **404** = el gateway no la publica.

| Ruta | Resultado |
|---|---|
| `/visits`, `/visits/pet/{id}`, `/visits/veterinary/{id}`, `/weight`, `/vaccines`, `/treatments`, `/medications`, `/surgery/pet/{id}`, `/lab`, `/pets/{id}/clinical-summary`, `/pets/{id}`, `/user/profile/{id}`, `/calendar-events`, `/notifications` | 401: publicadas |
| `/documents?petId=` (documentos de la veterinaria) | **404** con `GET`: no está publicada así; la app del dueño usa `/pets/{id}/documents` (401) |
| `/appointments`, `/me/appointments`, `/cron/...` | **404**: no hay citas fuera de `/api/veterinary/**` |
| `/api/veterinary/**` (clients, appointments, services, schedule-blocks, patients, availability…) | **401 para cualquier ruta**, incluso una inventada: no se puede saber desde fuera si existen. Se confirma con un token |

## 8. Lo que queda y por qué

| Pantalla | Bloqueo | Qué hace falta |
|---|---|---|
| Agenda | la cita (estado, servicio, duración, solicitud del dueño) no existe en `visits` ni en `calendar-events` | preguntas 3 y 4 de §5 |
| Clientes | no hay lista de dueños vinculados por clínica | pregunta 2 de §5 |
| Pacientes | no hay lista de mascotas compartidas con la clínica | pregunta 2 de §5 |
| Servicios y horarios | sin catálogo ni bloqueos | pregunta 4 de §5 |
| Inicio, Reportes | dependen de citas y pacientes | lo de arriba |

**Acciones locales que hoy no guardan nada** (muestran un aviso de éxito sin llamar al backend; no se ven porque esas pantallas están vacías, pero hay que reemplazarlas al conectar):
- Clientes → **Quitar cliente**: solo borra del store local. Debe llamar `DELETE /link/{vetId}/user/{userId}` (`LinkApi.unlink`) con el `userId` real de la lista.
- Agenda → cambios de estado (llegada, no asistió, cancelar) y **Nueva cita**.
- Servicios → crear, editar y desactivar servicio.
- Inicio → "Avisamos a N dueños sobre la vacuna vencida".
- Pacientes → "Enlace para reclamar enviado" y subir documento.
