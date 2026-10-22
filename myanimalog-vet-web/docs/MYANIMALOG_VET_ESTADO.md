# MyAnimaLogVet — Estado del trabajo

> Resumen de lo hecho y lo que falta en la parte veterinaria: diseño, código y organización en ClickUp.
> Última actualización: 9 de octubre de 2026.
> **Fecha límite de toda la parte Vet: martes 3 de noviembre de 2026.**

## Índice

1. Documentos de referencia
2. Diseño hecho en Figma
3. Diseño pendiente
4. Código pendiente
5. ClickUp
6. Plan de fechas hasta el 3 de noviembre
7. Riesgos y decisiones pendientes
8. Herramientas y cuentas

---

## 1. Documentos de referencia

| Documento | Qué tiene |
|---|---|
| [MYANIMALOG_VET_MAESTRO.md](MYANIMALOG_VET_MAESTRO.md) | Plan técnico de todo el ecosistema: contratos, endpoints, fases de backend. Es la fuente de verdad. |
| [MYANIMALOG_VET_CLIENTE.md](MYANIMALOG_VET_CLIENTE.md) | Lo que le toca a la app del dueño (Ionic): directorio, vincularse, compartir, reclamar, citas. |
| [MYANIMALOG_VET_NEGOCIO.md](MYANIMALOG_VET_NEGOCIO.md) | Negocio: ventajas frente a GVET, verificación, planes y precios (supuestos), entrevistas, demo. |
| [MYANIMALOG_VET_DISENO.md](MYANIMALOG_VET_DISENO.md) | Guía de diseño: paleta, reglas del turquesa, estados, tipografía, medidas, Inicio, Reportes y Agenda. |

---

## 2. Diseño hecho en Figma

Archivo `e9FbM805Y2oAmOgIbcL0Hj`, página única. Todo es del **panel web de la clínica** (1280 px de ancho) salvo que diga lo contrario.

### Registro y verificación de la clínica (fila y = 5875)

| Pantalla | Id |
|---|---|
| Antes de empezar (aviso de tratamiento de datos) | `1861:19` |
| 1 · Crea tu cuenta | `1899:73` |
| 2 · Tu clínica (NIT + DV, ubicación) | `1901:132` |
| 3 · Representante legal | `1902:215` |
| 4 · Documentos | `1910:20` |
| 5 · Perfil profesional | `1910:131` |
| 6 · Revisa y envía | `1910:244` |
| Estado: en revisión | `1911:109` |
| Estado: corrección | `1911:198` |
| Estado: aprobada | `1911:303` |
| Estado: rechazada | `1911:368` |

Además existían antes: Login MyAnimaLogVet (`1828:2`) y, en la app móvil, "VetAsosiation - empty" (`858:83`).

### Panel (fila y = 6819)

| Pantalla | Id |
|---|---|
| Inicio (propuesta) | `1932:159` |
| Reportes / analítica (propuesta) | `1935:182` |
| Agenda: día por profesional | `1941:174` |
| Agenda: con detalle de la cita abierto | `1942:174` |
| Pacientes: lista con búsqueda y filtros (propuesta, 7 oct) | `1958:174` |
| Pacientes: con la ficha abierta | `1959:174` |
| Pacientes: agregar paciente (QR, enviar enlace o registrar sin app) | `1961:219` |
| Pacientes: registrar sin app (paso 3 del modal) | `1959:698` |
| Clientes: lista de dueños vinculados (propuesta, 7 oct) | `1964:219` |
| Clientes: con la ficha del cliente abierta | `1964:905` |
| Equipo: miembros e invitaciones (propuesta, 7 oct) | `1965:219` |
| Equipo: ficha del miembro (veterinario con tarjeta en revisión) | `1966:219` |
| Equipo: modal invitar (correo + rol) | `1966:630` |
| Servicios y horarios: catálogo, horario de atención y bloqueos (propuesta, 8 oct) | `1971:225` |
| Mi clínica: perfil público, reservas en línea, código QR, vista previa en la app y datos legales (propuesta, 8 oct) | `1972:225` |
| Plan: prueba PRO, uso frente a los límites y FREE / BASIC / PRO (propuesta, 8 oct) | `1973:225` |

Con estas tres, todas las opciones del menú lateral tienen pantalla. Están en la fila y = 8382, en x = 8246, 9566 y 10886.

### Historia clínica del paciente (fila y = 9700, propuesta, 9 oct)

Es la página a la que lleva "Ver historia completa" en la ficha de Pacientes. Usa el mismo paciente (Toby, de Carlos Mendoza). Todas comparten la cabecera del paciente (alergia visible, dueño, "Registrar visita") y las pestañas. Cada registro muestra su origen: Clínica Patitas, otra clínica (VetCentro Bocagrande) o el dueño desde la app.

| Pantalla | Id |
|---|---|
| Resumen: línea de tiempo, alertas, vacunas, peso y de dónde viene la historia | `1997:225` |
| Consultas: lista y detalle con signos vitales, motivo, anamnesis, examen, diagnóstico, plan y auditoría | `1998:225` |
| Vacunas: carnet con lote, laboratorio, quién aplicó y próxima dosis; próximas y vencidas | `1998:710` |
| Tratamientos: activos con medicación y progreso, finalizados e historial de medicamentos | `2001:225` |
| Cirugías: detalle (anestesia, ASA, instrucciones), recorrido pre y posoperatorio, documentos | `2001:747` |
| Laboratorio: lista de exámenes y parámetros con rango normal e interpretación | `2002:225` |
| Peso: gráfica (clínica vs. dueño), registros y resumen | `2002:719` |

**Campos propuestos que el backend todavía no tiene:** signos vitales además de peso y temperatura (frecuencia cardíaca y respiratoria, mucosas, condición corporal), anamnesis y examen físico separados, riesgo ASA, laboratorio (fabricante) de la vacuna (MED-02 lo agrega como `manufacturer`) y la interpretación del examen. Falta la pestaña Documentos.

**Decisión (7 oct):** el registro manual no se quita, pero queda como última opción. Lo normal es que el dueño comparta con el código QR; el registro sin app sirve para atender hoy a quien no tiene la app, y la mascota pasa a su cuenta cuando la reclama. La solicitud de vinculación iniciada por la clínica quedó anotada en el maestro (§7.7.1) como fase posterior.

Al 7 de octubre todos los frames del registro y del panel están en la fila y = 7038, separados 40 px.

El frame "MacBook Air - 4" (`1868:2`) es un Inicio que el equipo está diseñando aparte; no se tocó.

### Componentes (frame "Vet · Componentes (registro)", `1908:2`)

`Vet/Campo` (`1908:3`), `Vet/Botón` (`1908:13`), `Vet/Documento` (`1908:48`) y `Vet/Saludo` (`1930:159`).

### Otros entregables

- **Prototipo animado del saludo** (perrito que salta, saluda y mueve la cola, con frases según la hora, el día y la carga): https://claude.ai/artifact/M4R2ewo2ud2VifhTML7ypx
- **Corrección pendiente:** el Inicio y la Agenda dicen "Lunes, 6 de octubre", pero el 6 de octubre de 2026 es martes.

---

## 3. Diseño pendiente

| Pantalla | Para |
|---|---|
| Agenda: vista semana, modal de nueva cita, estados especiales | Panel |
| Revisión de verificaciones (equipo MyAnimaLog) | Panel |
| Directorio de clínicas y perfil público | App del dueño |
| Vincularse con código o QR y "Mis veterinarias" | App del dueño |
| Clínicas con acceso (en el perfil de la mascota) | App del dueño |
| Reclamar mascota (`/claim/:token`) | App del dueño |
| Pedir cita y "Mis citas" | App del dueño |

---

## 4. Código pendiente

### App del dueño (este repo, Ionic + Angular)

1. Unificar la ruta Vet: hoy `/vet` (Home) y `/veterinary` (tab bar) no existen.
2. Modelos (`Veterinary`, `Appointment`, `PetClaim`…) y `VeterinaryService`.
3. Directorio y perfil público (integrable con `/maps`).
4. Vincularse por código o QR y "Mis veterinarias".
5. Compartir y revocar mascotas, "Clínicas con acceso".
6. Reclamar mascota.
7. Pedir cita y "Mis citas".
8. Migración de autenticación a refresh token: **solo cuando el backend la despliegue**.

### Panel web MyAnimaLogVet

**Todavía no existe el proyecto.** Hay que decidir dónde vive el repo; la recomendación es Angular 20 web, sin Ionic. Orden propuesto: proyecto + layout y menú → login y elección de clínica → registro y verificación → Inicio con el saludo animado → Agenda → Reportes → resto de pantallas.

### Otros pendientes de la app (fuera de Vet)

- Info de vacuna: "Eliminar" no borra (no hay endpoint), el recordatorio y el documento adjunto no se guardan, "Editar" no carga la vacuna.
- Botones de IA y de quitar anuncios del Home.
- Imágenes del tutorial con imágenes (`src/assets/images/Tutorial/`).
- `git push origin dev`: hay commits locales sin subir (mapa y vacunas).

---

## 5. ClickUp

Workspace "Workspace", espacio **Frontend**. Las tareas completas están ocultas por defecto: activar **"Show closed"** en la vista de lista para verlas.

### Hecho el 6 de octubre

- **13 tareas de código ya programadas** pasadas a completas: calendario A y B, documentos (ver, subir, info), historial médico (consultas, tratamientos, exámenes, cirugías), vacunas (línea de vida, info), "Historial médico + Documentos", "Vacunas" y "Pet profile + add pet".
- **Creadas como completas:** mapa de veterinarias, buscador y ruta en el mapa, tutorial, vistas adaptables + verify email y reset password.
- **Creadas por hacer:** info de vacuna (eliminar, recordatorio, editar), botones de IA y anuncios, imágenes del tutorial.
- **Lista Veterinary → "Desing"** (`901327070760`):
  - Registro y verificación de clínica: completa, 9 subtareas. https://app.clickup.com/t/wdx6zf56p8
  - Inicio del panel: completa, 3 subtareas. https://app.clickup.com/t/wdx6zf56p9
  - Reportes: completa. https://app.clickup.com/t/wdx6zf56pa
  - Guía de diseño: completa. https://app.clickup.com/t/wdx6zf56pc
  - Agenda: en progreso, vence el 9 oct (3 subtareas por hacer). https://app.clickup.com/t/wdx6zf56pb
  - Pantallas restantes del panel: vence el 16 oct (7 subtareas con fecha). https://app.clickup.com/t/wdx6zf56pd
  - App del dueño, parte Vet: vence el 21 oct (solo tiene la subtarea "Directorio"). https://app.clickup.com/t/wdx6zf56pe

### Falta crear

El conector de ClickUp permite 100 llamadas al día y el límite se alcanzó.

- Subtareas de "App del dueño, parte Vet": vincularse (19 oct), clínicas con acceso (20 oct), reclamar mascota (20 oct), pedir cita y "Mis citas" (21 oct).
- Lista Veterinary → Frontend Logic (`901327070808`): "Parte Vet — app del dueño (código)" y "Panel web MyAnimaLogVet (código)", con las subtareas y fechas de la sección 6.
- Lista Veterinary → QA/TESTING (`901327070810`): "Recorrido de prueba de punta a punta de la parte Vet" (3 nov).

---

## 6. Plan de fechas hasta el 3 de noviembre

Días hábiles; se saltan los festivos del lunes 12 de octubre y el lunes 2 de noviembre.

| Fecha | Diseño | Código app del dueño | Código panel web |
|---|---|---|---|
| 7–9 oct | Agenda: semana, nueva cita, estados | Unificar ruta /vet (9 oct) | |
| 13–16 oct | Pacientes, Clientes, Equipo, Servicios, Mi clínica, Plan, Revisión de verificaciones | Modelos y servicio (13 oct) | Proyecto + layout (14 oct), login (16 oct) |
| 19–21 oct | App del dueño: directorio, vincularse, clínicas con acceso, reclamar, citas | | Registro y verificación (21 oct) |
| 22–23 oct | | Directorio (22), vincularse (23) | Inicio con saludo (23) |
| 26–30 oct | | Compartir (26), reclamar (27), citas (29) | Agenda (28), Reportes (30) |
| 3 nov | | Migración de auth (si el backend está) | Pantallas restantes |
| **3 nov** | | **QA del recorrido completo** | |

---

## 7. Riesgos y decisiones pendientes

- **El plan es muy apretado.** El diseño termina el 21 de octubre y quedan menos de dos semanas para programar el panel completo y la parte Vet de la app al mismo tiempo.
- **Dependencia del backend.** Vinculación, citas, reclamos y la autenticación nueva dependen de fases de backend (VET Fase 4–5, PETS-04…06, CAL-xx, USER-01/02). Si no llegan a tiempo, esas pantallas quedan con datos de prueba.
- **Definir qué es "listo" el 3 de noviembre:** ¿funcionando con el backend real o con datos de prueba para la demo?
- **Dónde vive el código del panel web** y con qué stack.
- **Reportes por plan:** propuesta de que FREE y BASIC vean solo los 4 indicadores y el resto aparezca como "Disponible en PRO".
- **Línea de "ahora" de la Agenda en rojo:** es la convención de los calendarios, pero rompe la regla de "rojo solo para destructivo". Confirmar o cambiar a naranja.
- **Cifras de negocio** (precios, conversión, ingresos): son supuestos, falta validarlas con entrevistas a clínicas.

---

## 8. Herramientas y cuentas

- **Figma:** plan Professional con un puesto Full, pagado mes a mes desde el 6 de octubre (cuenta palaciodaniel275@gmail.com). Permite que Claude cree y edite pantallas sin el tope mensual del plan gratis.
- **ClickUp:** el conector tiene un límite de 100 llamadas al día.
- **Datos de ejemplo** en los diseños ("Clínica Patitas", "Ana Gómez", veterinarios, mascotas, NIT): son inventados.
