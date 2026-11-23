# Rutas que funcionan, qué falta en cada lado y qué se le pide a backend

Al 22 de noviembre de 2026. Cruza las colecciones de Postman (Calendar nueva del 22 nov, Medical del 20 nov, Vet carpetas 00–14), los docs de `docs/`, el código del panel (este repo)
y el de la app del dueño (`Frontend-MyAnimaLog`). Las pruebas contra Cloud Run fueron **sin token**: sirven para saber si una ruta existe, no si responde bien con datos.

Leyenda: ✅ existe y el cliente la usa · 🟡 existe, falta probar con sesión real · ⛔ no existe en el backend · ⬜ existe pero ese cliente no la usa.

## 1. Rutas: qué hay publicado

| Servicio | Ruta | Estado | Quién la usa |
|---|---|---|---|
| **Calendar** (`calendar-microservice-…run.app/api`, aparte del gateway) | `GET/POST /veterinaries/{id}/appointments`, `PATCH …/{aid}/confirm · reject · check-in · complete · no-show · cancel · reschedule` | 🟡 responden `401 MISSING_TOKEN` | Panel ✅ |
| | `GET /veterinaries/{id}/services` (**ruta de dueño**: token normal; con token de clínica da `403 OWNER_TOKEN_REQUIRED`) | 🟡 nuevo | Panel ✅ (con token normal) · Móvil ⬜ |
| | `POST /veterinaries/{id}/appointment-requests`, `GET /me/appointments` | 🟡 | Panel no aplica · **Móvil ⬜ no existe** |
| | `GET /veterinaries/{id}/availability` | ⛔ 404 | nadie |
| | **CORS** (`Access-Control-Allow-*`) | ⛔ no lo manda | bloquea al panel desplegado |
| **Veterinary** (`/api/veterinary/**`) | login/contexto, registro, perfil, equipo, invitaciones, plan, código QR, clientes, pacientes, admin | ✅ | Panel ✅ |
| | vincular, vista previa, mis clínicas, compartir/revocar, clínicas por mascota | ✅ | Móvil ✅ |
| | `/{id}/services` (CRUD), `/business-hours`, `/schedule-blocks`, `/employees/{id}/schedule` | ⛔ 404 con token (VET-31/32) | nadie |
| **Medical** (gateway `/api/…`) | visitas, peso, vacunas, tratamientos, cirugías, laboratorio, resumen clínico | ✅ | Panel ✅ · Móvil ✅ |
| | `POST …/{id}/corrections` (visitas, peso, vacunas, tratamientos, medicaciones, cirugía, laboratorio): **reemplazan** a los `PUT/PATCH` | 🟡 | Panel: solo tratamientos · Móvil: visitas y tratamientos |
| | `/api/allergies`, `/api/dewormings` | ⛔ **404 en el gateway** | Panel y Móvil las llaman |
| | `PUT /api/pets/{id}/clinical-profile` (esterilización) | 🟡 | Panel ✅ · Móvil ✅ |
| Documentos | `GET /documents?petId=` (clínica) | ⛔ 404 | Panel (Documentos) |

## 2. Lo que falta del lado del panel (nuestro)

| # | Qué | Por qué falta |
|---|---|---|
| 1 | **Corregir** visitas, peso, vacunas, medicaciones, cirugías, laboratorio y alergias (`/corrections`, con motivo obligatorio) y **anular** una desparasitación | La colección de Medical quitó los `PUT/PATCH`; hoy solo están conectadas las correcciones de tratamientos |
| 2 | Registrar paciente **sin app** y enviar invitación para reclamar | Bandera `patients` apagada: no hay endpoint |
| 3 | Pestaña **Documentos** de la historia | Ruta 404 |
| 4 | Catálogo de servicios (crear, editar, desactivar), horario y bloqueos | Código listo y apagado (`catalog`, `schedule`): esperan VET-31/32 |
| 5 | Horario por profesional | Sin endpoint |
| 6 | Horas libres reales al agendar | Sin `availability`; hoy se calcula en el panel y el servidor valida |
| 7 | Mostrar `cancellationReason` y `cancelledBy` de una cita cancelada | Falta pedirle a Calendar que los incluya |
| 8 | Desplegar: CORS de Calendar y URLs de producción de User y Veterinary (siguen en `REEMPLAZAR`) | Backend / infraestructura |

**Ya hecho en esta ronda:** "Nueva cita" lee los servicios reservables de Calendar con el token normal (antes quedaba bloqueado), y crear, confirmar, rechazar, llegada, atendida, no asistió,
cancelar y reprogramar llaman a Calendar. La cita trae `petName` (la colección lo exige), así que el nombre de la mascota se ve aunque el paciente no esté en la lista.

## 3. Lo que falta del lado móvil (app del dueño)

> **23 nov:** **Pedir cita** y **Mis citas** (puntos 1 y 2) ya están construidos en la app del dueño, con toda la lógica y sin conectar: solo falta llenar `environment.calendarUrl` y que Calendar permita CORS. También están las notificaciones `APPOINTMENT_*` (punto 3, tipos y navegación). Ver `CLAUDE.md` de `Frontend-MyAnimaLog`.

| # | Qué | Impacto en el panel |
|---|---|---|
| 1 | **Pedir cita**: ver servicios (`GET /veterinaries/{id}/services`), elegir hora y `POST /appointment-requests` | Sin esto la sección "Solicitudes de la app" de la Agenda nunca recibe nada |
| 2 | **Mis citas** (`GET /me/appointments`), cancelar y reprogramar (el dueño solo cancela con la anticipación mínima) y mostrarlas en el calendario, separadas de los eventos manuales | La clínica confirma o rechaza y el dueño no se entera dentro de la app |
| 3 | **Tipos de notificación** `APPOINTMENT_*`, `USER_LINKED`, `PET_CLAIMED`: hoy `NotificationType` solo conoce 6 tipos | Avisos de cita confirmada o rechazada |
| 4 | **Reclamar mascota** (`/pets/claims/*`, `/claim/:token`) | Cuando el panel registre pacientes sin app, el dueño no puede reclamarlos |
| 5 | Migrar las ediciones que siguen usando `PATCH /lab` y `PATCH /surgery/{id}` a `/corrections` (visitas y tratamientos ya migraron) | La colección nueva de Medical **quitó** esas rutas |
| 6 | Alergias y desparasitación: usan `/api/allergies` y `/api/dewormings` (404 en el gateway). El móvil trae un `medicalUrl` en el entorno para apuntar directo a Medical | El panel no tiene ese desvío |
| 7 | Mostrar en la historia el origen de cada registro ("Clínica X" frente a "Registrado por ti") y no dejar editar los de una clínica | El panel escribe con autoría de clínica |

## 4. Quién necesita qué del otro

| El panel necesita del móvil | El móvil necesita del panel |
|---|---|
| Que el dueño **comparta** mascotas (✅ existe) | Que la clínica **confirme/rechace** con motivo (✅ ya llama a Calendar) |
| Que el dueño **pida citas** (⛔ no existe) | Que el panel **publique servicios reservables** (⛔ catálogo VET-31; hoy solo lee los de Calendar) |
| Que el dueño **reclame** mascotas (⛔) | Que la clínica **registre sin app** y envíe la invitación (⛔) |
| Alergias y desparasitación del dueño (⛔ 404 en el gateway) | Las que confirma la clínica (✅ el panel las escribe, ⛔ mismo 404) |

## 5. Lo que se le pide a backend

1. **Publicar `/api/allergies` y `/api/dewormings` en el gateway** (hoy 404). Bloquea Salud de la mascota en el panel y en el móvil.
2. **CORS en Calendar** para el dominio del panel y de la app (`GET, POST, PATCH, PUT, DELETE`, cabecera `Authorization`).
3. **Catálogo, horario y bloqueos (VET-31/32)** en Veterinary: `/{id}/services` (CRUD), `/business-hours`, `/schedule-blocks`. Y que el `PUT` de `business-hours` diga su cuerpo.
4. **Calendar sobre datos reales:** que lea servicios y empleados de Veterinary en lugar de los `SIM_*`.
5. **Cita completa:** que `GET/PATCH …/appointments` devuelvan también `petId`, `serviceId`, `serviceName`, `price`, `notes`, `cancellationReason`, `cancelledBy`. Y los servicios, `employeeIds` (quién los presta).
6. **`GET …/availability`** (franjas libres).
7. **Documentos de la veterinaria** (`/documents`) publicados en el gateway.
8. Una clínica aprobada con servicios, empleados, una mascota compartida y una cita de ejemplo, para la prueba de punta a punta.

## 6. Cómo probar hoy

1. `npm start` (el proxy manda `/calendar-api` a Calendar en Cloud Run).
2. Entrar con una cuenta de clínica **aprobada**: debería cargar clientes, pacientes, agenda y los servicios reservables.
3. Si "Nueva cita" dice que no hay servicios, la clínica no tiene servicios con reserva en línea en Calendar.
4. Si la agenda dice "No pudimos cargar las citas", copiar de la pestaña Network el estado y el cuerpo de la respuesta (sin la cabecera `authorization`).
