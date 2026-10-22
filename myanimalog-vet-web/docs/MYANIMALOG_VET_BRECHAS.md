# MyAnimaLogVet — Brechas entre docs, backend, código y diseño

> Qué no concuerda y qué falta para que la app del dueño, el panel de la clínica, el backend y los diseños de Figma cuenten la misma historia.
> Fuentes revisadas: los 5 documentos de `docs/`, la guía del backend `GUIA_FRONTEND_VETERINARY.md` (13 oct), el código de este repo y el Figma `e9FbM805Y2oAmOgIbcL0Hj` (último frame `2002:719`).
> Fecha: 13 de octubre de 2026.

## Índice

1. Resumen
2. Docs frente al backend real
3. App del dueño: código
4. Panel web MyAnimaLogVet: código
5. Diseño: app del dueño
6. Diseño: panel de la clínica
7. Ficha del paciente e historia clínica
8. Datos que el diseño muestra y nadie guarda
9. Decisiones pendientes
10. Orden sugerido
11. Diseños hechos el 13 de octubre

---

## 1. Resumen

| Frente | Estado | Brecha principal |
|---|---|---|
| Backend Veterinary | Terminado en local, **sin desplegar** | Va por la fase 2 del maestro: para el dueño solo hay vincular y desvincular |
| Docs | Escritos contra el maestro (el plan) | Usan rutas y respuestas que el backend todavía no tiene |
| App del dueño (código) | `/vet` con el estado vacío, auth con refresh | No hay `VeterinaryService` ni modelos; una ruta rota |
| Panel web (código) | **No existe** | Falta decidir repo y stack |
| Diseño del panel | Completo, con estados y roles (13 oct) | Falta la Agenda en vista semana, nueva cita y estados especiales |
| Diseño de la app del dueño | Completo (13 oct, 25 pantallas) | El historial con "Registrado por ti" depende de la decisión §9.1 |

> **Actualización 13 oct:** las pantallas que faltaban de los §5, §6 y §7 ya están en Figma. Ver el §11 con los ids.

---

## 2. Docs frente al backend real

La guía del backend describe lo que existe hoy; el maestro, lo que se planea. Antes de conectar, confirmar en Swagger (`http://localhost:8082/swagger-ui.html`).

| Tema | Maestro / CLIENTE / CLAUDE.md | Backend real (guía) |
|---|---|---|
| Prefijo de rutas | `/veterinaries/...`, `/me/...`, `/public/...` | `/api/veterinary/...` |
| Registrar clínica | `POST /veterinaries` | `POST /api/veterinary/register` |
| Mis clínicas (empleado) | `GET /me/veterinaries` | `GET /api/veterinary/me` |
| Vincularse | `POST /veterinaries/link { code }` (unificado) | Siguen `LinkByCode` y `LinkByUrl` por separado, sin `userId` |
| Desvincularse (dueño) | `DELETE /veterinaries/{id}/link` | `DELETE /api/veterinary/link/{vetId}/user/{miUserId}` |
| Respuesta del login | `{ accessToken, refreshToken, expiresIn: 900 }` (CLIENTE §3.1) | `{ token, refreshToken, expiresIn }` con 3600 |
| Id del usuario | claim `sub` | claim `id` (el código ya lo lee así) |
| Empleados | Invitaciones por email | `POST /api/veterinary/employees` con `userId`; invitaciones en la siguiente fase |
| Mis clínicas vinculadas (dueño) | `GET /me/linked-veterinaries` | **No existe** |
| Vista previa por código | `GET /public/veterinaries/by-code/{code}` | **No existe** |
| Directorio, compartir, reclamos, citas | Definidos | **No existen** ("próximamente") |

**Consecuencia:** después de vincularse, la app no tiene cómo listar "Mis veterinarias" ni mostrar la clínica antes de confirmar. Pedir al backend que adelante `GET /me/linked-veterinaries` y la vista previa por código, o la pantalla queda con datos de prueba.

**Docs que hay que corregir:**

- `MYANIMALOG_VET_CLIENTE.md` §2 dice que `/vet` no existe y que el tab bar va a `/veterinary`: ya se unificó el 9 oct. §3.1 dice `accessToken`: es `token`.
- `MYANIMALOG_VET_ESTADO.md` §4 y §6: "Unificar ruta" ya está hecho y no menciona la guía del backend.
- `CLAUDE.md`, sección "Endpoints del dueño": aclarar que son las rutas objetivo y que hoy el prefijo es `/api/veterinary`.

---

## 3. App del dueño: código

### Ya está

- `/vet` unificado (Home, acceso rápido, tab bar), con el estado vacío de Figma; "Empieza" lleva a `/maps`.
- `AuthService` y `AuthInterceptor` coinciden con la guía: `token` + `refreshToken`, un solo refresh en curso y Bearer en todas las llamadas a `apiUrl` (incluye `/api/veterinary/**`). El 401 del gateway (`{ error, status }`) se maneja por `status`.
- `/maps` con veterinarias de Google, ruta y "Agendar cita" como evento local.

### Falta

| # | Qué | Dónde | Depende de |
|---|---|---|---|
| 1 | **Ruta rota:** "Asociar veterinaria" en el paso médico de add-pet navega a `/veterinarias` y cae al login | `views/add-pet/steps/step-medical/step-medical.component.ts:93` → `/vet` | Nada |
| 2 | Modelos `Veterinary`, `LinkedVeterinary`, `Appointment`, `PetClaim`, `ClinicService` | `models/` | Nada (con datos de prueba) |
| 3 | `VeterinaryService` con vincular y desvincular | `services/VeterinaryService/` | Backend desplegado |
| 4 | Pantalla "Vincular con código" (+ QR) y "Mis veterinarias" | `views/vet/` | 3 y `GET /me/linked-veterinaries` |
| 5 | Mensajes de error: clínica no activa ("Esta clínica todavía no está disponible"), ya vinculado (409), 503 "intenta de nuevo" | `VeterinaryService` / pantalla | 3 |
| 6 | Confirmación al desvincular: avisar que se revocan todas las mascotas compartidas | `views/vet/` | 3 |
| 7 | "Clínicas con acceso" en el perfil de la mascota | `views/pet-profile/` | VET-27 |
| 8 | Compartir mascotas al vincularse (solo las de rol `OWNER`) | `views/vet/` | VET-27 |
| 9 | Reclamar mascota: ruta `/claim/:token`, volver al reclamo después del login, pendientes en el Home, texto "la clínica conserva el acceso" | `views/claim/`, `views/login/`, Home | PETS-05/06 |
| 10 | Pedir cita y "Mis citas"; mostrarlas en el calendario, separadas de los eventos manuales | `views/vet/`, `views/calendar/` | VET-30…33, CAL-xx |
| 11 | Leer `email_verified` del token (lo exigen los reclamos) | `AuthService` | USER-02 |
| 12 | `NotificationType` no conoce los eventos nuevos (`USER_LINKED`, `PET_CLAIMED`, `APPOINTMENT_*`…) ni navega a la pantalla que toca | `models/notification.model.ts`, `notification-card` | NOTIF-01…03 |
| 13 | Historia clínica: mostrar "Registrado por Clínica X" y ocultar crear/editar en registros de una clínica (MED-03 devuelve 403 al dueño) | `views/medical-history/`, `vaccine-info` | MED-02/03 y la decisión del §9 |
| 14 | Peso: la app solo guarda `pet.weight`. Medical tiene `WeightRecord` con `Source = OWNER`, pero la app no registra ni muestra historial de peso | `MedicalHistoryService`, `pet-profile` | Endpoint de peso en Medical |
| 15 | Quitar `userId`/`ownerId` de bodies y pasar `/pets/user/{id}` a `/pets/me` | Todos los servicios | PETS-02 |

---

## 4. Panel web MyAnimaLogVet: código

No hay repo ni carpeta. La recomendación del ESTADO es Angular 20 web, sin Ionic. Lo que el backend ya permite construir, según la guía:

| Pantalla | Endpoint real | Nota |
|---|---|---|
| Login y "Mis clínicas" (selector) | `/api/auth/local`, `GET /api/veterinary/me` | **Sin diseño** (ver §6) |
| Entrar a una clínica | `POST /api/auth/context/veterinary/{id}` | Guardar el token de clínica aparte del normal |
| Salir de la clínica | `POST /api/auth/context/user` | |
| Refresh de clínica | `POST /api/auth/refresh` | 401 `VETERINARY_MEMBERSHIP_REVOKED` → al selector |
| Registro | `POST /api/veterinary/register` | Solo datos de la clínica; documentos y perfil profesional todavía no |
| Banner de estado | claim `vet_status` | |
| Menús por rol | claim `vet_role` | Matriz de la guía §4 |
| Mi clínica / configuración | `GET`, `PATCH /api/veterinary/{id}` y `/settings` | |
| Código de invitación | Generar (Swagger) y `DELETE /api/veterinary/{id}/invite-code` | `VET-XXXXXXXX` + link + QR |
| Plan | Plan activo y si está vencido | Sin pago |
| Admin de plataforma | `/api/veterinary/admin/veterinaries/{id}/suspend` y `/reactivate` | Solo `PLATFORM_ADMIN`; **sin diseño** |

---

## 5. Diseño: app del dueño

Hoy solo existe "VetAsosiation - empty" (`858:83`). Para que la app cuente lo mismo que el panel faltan:

| # | Pantalla | Contenido mínimo | Concuerda con |
|---|---|---|---|
| 1 | Vincular con código o QR | Campo `VET-XXXXXXXX`, botón "Escanear QR", errores (no activa, ya vinculado) | "Mi clínica: código QR" (`1972:225`) |
| 2 | Vista previa de la clínica | Logo, nombre, dirección, sello "Verificada", botón "Vincularme" | Sello turquesa (DISENO §3) |
| 3 | Elegir mascotas para compartir | Solo mascotas propias; aviso de que la clínica podrá leer la historia | Pacientes "Conectado a la app" (`1959:174`) |
| 4 | Mis veterinarias | Lista; detalle con mascotas compartidas, "Desvincular" en rojo con aviso de revocación | Clientes (`1964:219`) |
| 5 | Clínicas con acceso (en el perfil de la mascota) | Lista de clínicas, desde cuándo, "Quitar acceso" en rojo | "De dónde viene la historia" (`1997:225`) |
| 6 | Reclamar mascota (`/claim/:token`) | Datos de la mascota, clínica que la registró, texto obligatorio de acceso, "Aceptar" | Pacientes "Por reclamar" y registro sin app (`1959:698`) |
| 7 | Reclamos pendientes en el Home | Tarjeta o aviso | — |
| 8 | Directorio y perfil público | Búsqueda, mapa con clínicas MyAnimaLogVet junto a las de Google, servicios y precios | Mi clínica: "vista previa en la app" (`1972:225`) |
| 9 | Pedir cita | Servicio → fecha → franja → mascota → confirmar; ofrecer compartir si la mascota no está compartida | Servicios y horarios (`1971:225`) |
| 10 | Mis citas | Chips de estado de DISENO §4 con ícono; cancelar deshabilitado fuera de plazo con explicación | Agenda (`1941:174`) |
| 11 | Historia clínica del dueño con origen | Etiqueta "Clínica Patitas" / "Registrado por ti" en cada registro; sin "Editar" en registros de clínica | Historia clínica del panel (`1997:225`…) |

La pantalla `858:83` debería pasar a ser la "entrada" con dos caminos: "Tengo un código" (1–3) y "Buscar clínicas" (8). Hoy "Empieza" solo lleva al mapa de Google.

---

## 6. Diseño: panel de la clínica

Ya pendiente en el ESTADO: Agenda (semana, nueva cita, estados especiales) y Revisión de verificaciones.

Falta además, para que concuerde con la guía y el maestro:

| # | Pantalla o estado | Por qué |
|---|---|---|
| 1 | **Selector "Mis clínicas"** después del login | La guía §5.2 lo pide (una persona puede estar en varias clínicas con roles distintos). Incluye el caso vacío: "Registrar mi clínica" |
| 2 | **Banner de estado dentro del panel** | La guía §3: banner permanente cuando `vet_status != ACTIVE`. Los frames `1911:*` son pantallas completas del registro, no el panel con el banner |
| 3 | Clínica suspendida | Puede ver su información pero no operar |
| 4 | Pedir verificar el email antes de registrar | El registro exige `email_verified = true` |
| 5 | **Inicio por rol** | DISENO §8 dice que el Inicio cambia por rol, pero solo hay una versión. Faltan recepción y veterinario |
| 6 | Menú lateral por rol | Ocultar Equipo, Plan, Reportes y Mi clínica según la matriz |
| 7 | Aceptar invitación de empleado | El correo lleva a una pantalla de aceptar o rechazar |
| 8 | Mi perfil profesional (del veterinario invitado) | Subir tarjeta y cédula; hoy solo está el paso 5 del registro del dueño de la clínica |
| 9 | Panel de administración de la plataforma | Lista de clínicas, aprobar (reactivar) y suspender; solo `PLATFORM_ADMIN` |
| 10 | Límite del plan alcanzado | Mensajes al compartir o registrar pacientes por encima de `max_patients` |
| 11 | Corregir la fecha "Lunes, 6 de octubre" (era martes) | Pendiente desde el ESTADO |

---

## 7. Ficha del paciente e historia clínica

**La ficha (`1959:174`) y la historia (`1997:225` a `2002:719`) están bien especificadas:** cabecera con alergia visible, pestañas por tipo, origen de cada registro, autor con tarjeta verificada, signos vitales, auditoría ("Ver cambios") y relación con la cita. No hace falta rediseñarlas. Faltan piezas para cubrir todos los casos:

| # | Qué falta | Por qué |
|---|---|---|
| 1 | **Pestaña Documentos** | Está en las pestañas (3) pero no tiene frame. Ya anotado en el ESTADO |
| 2 | **Vista de recepción** | El diseño dice "Recepción: solo Resumen", pero el Resumen muestra diagnósticos, laboratorios y tratamientos. `RECEPTIONIST` solo tiene `CLINICAL_READ_BASIC` (nombre, especie, alergias, próxima cita), que corresponde al `clinical-summary` de MED-07. Hace falta un Resumen básico: alergias, vacunas vigentes o vencidas, tratamientos activos, último peso y próxima cita, sin línea de tiempo clínica |
| 3 | **Acceso revocado** | Qué ve la clínica cuando el dueño quita el acceso: la ficha queda con datos básicos y un aviso, sin historia ni "Registrar visita" |
| 4 | **Paciente "Por reclamar"** | La ficha muestra "Conectado a la app". Para una mascota registrada sin app: chip "Por reclamar", contacto del dueño, "Reenviar invitación" y vencimiento (30 días) |
| 5 | **Veterinario sin tarjeta verificada** | El aviso "Solo veterinarios con tarjeta verificada…" existe, pero no el estado del botón "Registrar visita" deshabilitado ni el de asistente (puede vacunas y peso, no consultas) |
| 6 | **Paciente nuevo sin historia** | Estado vacío de la línea de tiempo y de cada pestaña |
| 7 | **Formulario "Registrar visita"** | El botón existe en la cabecera, pero no hay frame del formulario (signos vitales, motivo, anamnesis, examen, diagnóstico, plan), ni de aplicar vacuna o registrar peso desde la clínica |

---

## 8. Datos que el diseño muestra y nadie guarda

Hoy ningún servicio ni contrato del maestro guarda estos datos:

| Dato en el diseño | Dónde aparece | Situación |
|---|---|---|
| **Alergias / alertas clínicas** | Cabecera, ficha, Resumen | No hay tabla ni campo en Pets ni en Medical. MED-07 promete "alergias" en `clinical-summary` sin decir de dónde salen. **Es la brecha más importante:** es el dato más visible de la ficha |
| Microchip | Ficha y cabecera | `Pet` no lo tiene |
| Esterilizado | Cabecera | `Pet` no lo tiene |
| Frecuencia cardíaca y respiratoria, mucosas, condición corporal | Consultas, Peso | Ya anotado en el ESTADO; Medical solo tiene peso y temperatura |
| Anamnesis y examen físico separados, ASA | Consultas, Cirugías | Ya anotado en el ESTADO |
| Interpretación del examen de laboratorio | Laboratorio | Ya anotado en el ESTADO |
| Nombre de la clínica de cada registro ("VetCentro Bocagrande") | Todas las pestañas | MED-02 guarda `veterinary_id`, no el nombre. Falta definir cómo el panel y la app obtienen los nombres (por ejemplo `/public/veterinaries/{id}` o un batch) |
| Tarjeta profesional del autor | Consultas | Existe en `professional_profiles`, pero no hay un endpoint para leerla desde Medical |

En la app del dueño, `Vaccine` y `Visit` guardan al veterinario como texto libre (`veterinarian`). Cuando los registros vengan de una clínica, la app tendrá que mostrar la clínica y el autor que manda Medical.

---

## 9. Decisiones pendientes

1. **¿Qué puede escribir el dueño en la historia?** Con MED-03 el dueño recibe 403 al crear visitas, vacunas, tratamientos, laboratorios o cirugías. El diseño del panel muestra "Registrado por el dueño" solo en peso. Opciones: (a) ocultar esos formularios en la app, (b) mantenerlos como registros propios marcados "Registrado por el dueño" (el backend tendría que permitirlo). Afecta a 6 pantallas de la app que ya existen.
2. **Alergias:** ¿en Pets (dato de la mascota que el dueño también edita) o en Medical (dato clínico con autor)?
3. **Pedir al backend que adelante** `GET /me/linked-veterinaries` y la vista previa por código, para que la parte de vincularse no quede a medias.
4. Las ya listadas en el ESTADO §7: qué significa "listo" el 3 nov, dónde vive el panel, reportes por plan y la línea roja de "ahora".

---

## 10. Orden sugerido

1. Corregir la ruta `/veterinarias` (§3 #1) y los docs desactualizados (§2).
2. Modelos y `VeterinaryService` con las rutas de la guía, confirmadas en Swagger.
3. Diseñar en Figma las pantallas 1–6 del §5 (vincular, vista previa, compartir, mis veterinarias, clínicas con acceso, reclamar).
4. Decidir §9.1 y §9.2 antes de tocar la historia clínica de la app.
5. Diseñar en el panel el selector de clínicas, el banner y la vista de recepción (§6 #1–2, §7 #2).
6. El resto según el plan de fechas del ESTADO.

---

## 11. Diseños hechos el 13 de octubre

Todo en el Figma `e9FbM805Y2oAmOgIbcL0Hj`, con "(13 oct)" en el nombre del frame. Siguen la guía de diseño: Afacad en el panel, Jua y Actor en la app, un solo color de acción (morado), turquesa neón solo para "verificada" y rojo solo para acciones destructivas.

### Historia clínica y ficha del paciente (§7)

| Pantalla | Id | Cubre |
|---|---|---|
| Historia clínica · Documentos | `2026:225` | §7 #1. Origen de cada documento; solo se elimina lo que subió tu clínica |
| Historia clínica · Recepción: resumen básico | `2027:225` | §7 #2. Solo `CLINICAL_READ_BASIC`: alergias, vacunas, tratamientos activos, peso y citas. Sin Reportes en el menú |
| Historia clínica · Registrar visita | `2028:225` | §7 #7. Signos vitales, motivo, anamnesis, examen, diagnóstico, plan; desde la cita; autor con tarjeta |
| Historia clínica · Paciente nuevo sin historia | `2029:225` | §7 #6 |
| Ficha: acceso revocado | `2030:225` | §7 #3. Sin historia; la cita futura se cancela |
| Ficha: por reclamar | `2030:783` | §7 #4. Invitación, vencimiento, reenviar, editar datos |
| Ficha: asistente o veterinario sin tarjeta | `2030:1352` | §7 #5. Aplicar vacuna y peso sí; registrar visita no |

### App del dueño (§5)

| Pantalla | Id |
|---|---|
| Sin clínicas: dos caminos ("Tengo un código" / "Buscar clínicas") | `2031:225` |
| Vincular con código o QR | `2031:259` |
| Código: clínica no disponible y otros errores (no válido, ya vinculado, sin conexión) | `2031:295` |
| Vista previa de la clínica | `2031:338` |
| Elegir mascotas para compartir (las "a tu cuidado" no se pueden) | `2031:384` |
| Mis veterinarias | `2032:227` |
| Detalle de mi veterinaria (mascotas compartidas, citas, desvincular) | `2032:279` |
| Desvincularme: confirmación | `2032:342` |
| Pet profile · Clínicas con acceso | `2032:416` |
| Pet profile · Quitar acceso: confirmación | `2032:469` |
| Reclamar mascota `/claim/:token` (con el texto obligatorio de acceso) | `2033:225` |
| Reclamar: estados (aceptado, correo distinto, correo sin verificar, vencida) | `2033:256` |
| Home con reclamo pendiente | `2033:281` |
| Directorio de clínicas | `2033:369` |
| Perfil público de la clínica (servicios y precios, horario) | `2033:447` |
| Pedir cita 1: servicio | `2034:225` |
| Pedir cita 2: fecha y hora | `2034:282` |
| Pedir cita 3: mascota y confirmar (ofrece compartir si no lo está) | `2034:361` |
| Mis citas (estados con ícono; cancelar deshabilitado fuera de plazo) | `2034:426` |
| Historial médico con el origen de cada registro (**propuesta**, ver §9.1) | `2034:508` |

### Panel de la clínica (§6)

| Pantalla | Id | Cubre |
|---|---|---|
| Elige tu clínica (con invitación pendiente) | `2035:225` | §6 #1 y #7 |
| Elige tu clínica: sin clínicas | `2035:284` | §6 #1 |
| Verifica tu correo antes de registrar | `2035:313` | §6 #4 |
| Aceptar invitación de empleado | `2035:351` | §6 #7 |
| Inicio: clínica pendiente de aprobación (banner + "Configura tu clínica") | `2037:225` | §6 #2 |
| Inicio: clínica suspendida | `2037:573` | §6 #3 |
| Inicio: recepción | `2037:865` | §6 #5 y #6 |
| Inicio: veterinario | `2037:1176` | §6 #5 y #6 |
| Mi perfil profesional (en revisión, Julián Rojas) | `2039:267` | §6 #8 |
| Pacientes: límite del plan | `2039:740` | §6 #10 |
| Admin de plataforma · Revisión de verificaciones | `2040:300` | §6 #9 |
| Admin de plataforma · Clínicas: suspender y reactivar | `2040:753` | §6 #9 |

### Correcciones a frames que ya existían

- **Fecha:** "Lunes, 6 de octubre" → "Martes" en Inicio (`1932:159`) y Agenda (`1941:174`, `1942:174`). La frase del saludo ya no dice "Arrancamos la semana".
- **Historia del plan de Clínica Patitas:** el Inicio decía "Prueba PRO, 24 días", Plan "quedan 17 días", y a la vez había clientes y registros desde marzo (imposible: la prueba empieza al aprobar). Quedó así: **Clínica Patitas está aprobada desde el 3 mar 2026 y paga PRO** (renueva el 3 nov). Se ajustaron Plan (`1973:225`), Inicio, Equipo y Admin. La prueba de 30 días se muestra en clínicas nuevas (Inicio pendiente, Admin).
- **Pacientes:** Plan decía 342 y Pacientes 248. Quedó 248 en los dos (148 por encima del límite de FREE).

### Sigue pendiente de diseño

- Agenda: vista semana, modal de nueva cita y estados especiales (ya estaba en el ESTADO).
- Notificaciones de la app con los eventos nuevos (`USER_LINKED`, `PET_CLAIMED`, `APPOINTMENT_*`).
- Las decisiones §9.1 (qué escribe el dueño) y §9.2 (dónde viven las alergias) pueden cambiar `2034:508` y la cabecera del paciente.

