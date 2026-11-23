# Avance de la parte Vet: qué funciona, qué no y por qué

Al 22 de noviembre de 2026 (el cuadro de rutas y brechas actualizado está en `ESTADO_RUTAS_Y_BRECHAS.md`). Cruza las pantallas de Figma (`MYANIMALOG_VET_ESTADO.md`, `MODULO_MEDICO.md`), el Maestro, las dos colecciones de Postman
(`MyAnimaLogVet…(1)` con 69 endpoints de veterinary-service y `Medical Pet Backend · Dueño y Veterinaria` con 83 de Medical) y el código del panel.

Leyenda: ✅ conectado al backend real · 🟡 conectado, falta probar con datos reales · ⛔ pantalla hecha pero **sin endpoint** · ⬜ sin pantalla.

La colección nueva de Medical trae **los mismos 83 endpoints** que la anterior (solo cambia que los ids vienen escritos en lugar de variables). No agrega rutas.

## 1. Pantalla por pantalla

| Pantalla (Figma) | Estado | Qué hay / qué falta |
|---|---|---|
| Login (local y Google) | ✅ | |
| Registro de clínica (6 pasos) y estados (en revisión, corrección, rechazada, borrador, aprobada) | ✅ | Falta probar el envío final con una clínica nueva |
| Elegir clínica | ✅ | |
| **Admin**: verificaciones, clínicas (ficha y plan), profesionales | ✅ | `GET /admin/veterinaries` sin filtro daba 500 en Cloud Run (hay respaldo por estado) |
| Mi perfil profesional (datos, documentos, firma, envío) | ✅ | |
| Mi clínica (datos, logo, código QR, reservas en línea) | ✅ | Algunos ajustes (`settings`) dependen de un endpoint que no está en Postman |
| Equipo (miembros, invitaciones, rol, activar/desactivar) e invitación (lado del invitado) | ✅ | |
| Plan (plan vigente, vencimiento) | ✅ | Falta uso frente a límites y cambio de plan (`subscription/usage`, `checkout`) |
| **Historia clínica** `/pacientes/:petId/historia`: Resumen, Consultas, Vacunas, Peso, Tratamientos, Cirugías, Laboratorio | 🟡 | Lectura y escritura (visita, vacuna, peso, tratamiento, medicamento, cirugía, estado, examen con parámetros). No se abre desde ningún listado todavía |
| Historia clínica · Documentos | ⛔ | `GET /documents?petId=` da 404 en el gateway; la ruta de documentos de la veterinaria no está publicada |
| Historia clínica · Peso con gráfica (clínica vs dueño) | 🟡 | Hay lista con cambio; falta la gráfica |
| Inicio (saludo, plan, pendientes) | 🟡 | Saludo, plan e invitaciones del equipo sí; **citas de hoy, solicitudes y vacunas vencidas** no |
| Agenda (día por profesional, semana, detalle de la cita, nueva cita, solicitudes, reprogramar) | 🟡 | Conectada al calendar-service (colección "Calendar Microservice"): estados, servicio y duración vienen de la cita. Calendar es un servicio aparte en Cloud Run (las rutas existen, piden token); **falta CORS para el panel desplegado** y el endpoint de disponibilidad. Ver `ADAPTACION_ENDPOINTS_VET.md` §6 |
| Pacientes (lista, ficha, agregar paciente, por reclamar, acceso revocado) | 🟡 | La lista y la ficha leen `GET /{id}/patients` (conectado). Falta registrar paciente sin app y la invitación para reclamar |
| Clientes (lista, ficha, quitar cliente) | 🟡 | Conectado a `GET /{id}/clients` y `DELETE /{id}/clients/{userId}`; "Mostrar código QR" funciona |
| Servicios y horarios (catálogo, horario, bloqueos) | 🟡 | Catálogo, horario de atención y bloqueos conectados (sin probar con token). Falta el horario por profesional |
| Reportes | ⬜ | Solo "Pronto"; depende de citas, pacientes y servicios |

## 2. Qué bloquea y quién lo desbloquea

Todo lo que falta se reduce a **cuatro** respuestas del backend (detalle en `ADAPTACION_ENDPOINTS_VET.md` §5). Con ellas se conectan Pacientes, Clientes, Agenda, Servicios, Inicio y Reportes:

1. ¿Con el token de clínica se puede leer `GET /pets/{id}` y `GET /user/profile/{id}` de una mascota o dueño que compartió con la clínica?
2. ¿Qué endpoint lista las mascotas y los dueños **vinculados a una clínica**? (Y el de **compartir** una mascota con la clínica, que tampoco está en Postman.)
3. ¿La cita de la clínica es una `visit` con estado, o un `calendar-event`? El Figma pide estados (por confirmar, confirmada, en la clínica, atendida, no asistió) que una visita no tiene.
4. ¿Dónde viven el catálogo de servicios, el horario y los bloqueos?

Sin el punto 2 tampoco se puede probar la Historia clínica con datos reales: necesita el id de una mascota compartida con la clínica.

## 3. Lo que puedo hacer sin esperar al backend

| Qué | Para qué |
|---|---|
| Gráfica de peso (clínica vs dueño) en la historia | Cierra la pestaña Peso del Figma |
| Quitar el aviso de éxito falso de las acciones locales (Clientes, Agenda, Servicios, Inicio, Pacientes) | Que ninguna pantalla diga "guardado" sin guardar |
| Renovar el token cada ~60 min y al cambiar de rol o estado | Hoy solo se renueva ante un 401 o 403 |
| Entorno de producción (URLs reales, CORS) y guía de despliegue en Google Cloud | Publicar el panel |
| Segundo botón de login "MyAnimaLog" del Figma | Cierra el login |
| Borrar documentos subidos durante el registro | Endpoints `DELETE …/verification/documents/{id}` (Postman 03) |

## 4. Para que "funcione todo"

1. Responder las cuatro preguntas de §2 (las rutas exactas, si ya existen). Con eso conecto Pacientes, Clientes, Agenda y Servicios en ese orden.
2. Una clínica **aprobada** y una mascota **compartida** con ella, para probar la historia clínica de punta a punta.
3. Un token de prueba **no** hace falta pegarlo: basta con la respuesta de Network de las pantallas que fallen, sin la cabecera `authorization`.
