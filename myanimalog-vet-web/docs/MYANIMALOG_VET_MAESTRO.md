# MyAnimaLogVet — Documento maestro del microservicio de veterinaria

> Documento único con todo el contexto y el plan técnico para construir la parte de veterinarias (B2B) de MyAnimaLog.
> Sirve como contexto para Claude Code en cualquier repo del ecosistema y como hoja de ruta del equipo.
> Fecha: octubre 2026.
>
> Equivalencias de referencias internas: `CONTRATOS_COMPARTIDOS.md` = sección 6, `VETERINARY_SERVICE_PLAN.md` = sección 7, `USER_SERVICE_CHANGES.md` = 8, `PETS_SERVICE_CHANGES.md` = 9, `MEDICAL_SERVICE_CHANGES.md` = 10, `CALENDAR_SERVICE_CHANGES.md` = 11, `NOTIFICATIONS_SERVICE_CHANGES.md` = 12, `IA_SERVICE_CHANGES.md` = 13. Los IDs de tarea (`VET-xx`, `USER-xx`, `PETS-xx`, `MED-xx`, `CAL-xx`, `NOTIF-xx`, `IA-xx`) se mantienen.

## Índice

1. Contexto del proyecto
2. Decisiones de arquitectura
3. Qué podrá hacer una veterinaria
4. Validación del registro de veterinarias
5. Orden de trabajo entre repos
6. Contratos compartidos (JWT, permisos, eventos)
7. Plan del veterinary-service
8. Cambios en user-service
9. Cambios en Pets
10. Cambios en Medical
11. Cambios en Calendar / citas
12. Cambios en Notificaciones
13. Cambios en IA-service

---

## 1. Contexto del proyecto

**MyAnimaLog** es un proyecto de grado con modelo B2C + B2B:

- **MyAnimaLog (B2C):** app móvil para dueños de mascotas, con el perfil, documentos e historia clínica de cada mascota.
- **MyAnimaLogVet (B2B):** SaaS web que se vende a veterinarias para gestionar su clínica, personal, pacientes, agenda y atención clínica, conectado a la misma información que el dueño tiene en su app.

### Microservicios del ecosistema

| Servicio | Stack | Responsabilidad |
|---|---|---|
| user-service | (asumido Spring Boot 3 / Java 17) | Cuentas, login, emisión de JWT |
| pet-service (Pets) | Spring Boot 3.5 / Java 17, hexagonal, PostgreSQL, Supabase Storage, Pub/Sub | Mascotas, fotos, documentos, compartir mascota entre usuarios, invitaciones |
| veterinary-service | Spring Boot 3.5 / Java 17, hexagonal, PostgreSQL (Supabase) | Clínicas, verificación, personal y roles, pacientes y consentimiento, catálogo, horarios, suscripción SaaS |
| medical-pet-backend | Next.js 16 / TypeScript, Clean Architecture, Supabase, Pub/Sub | Historia clínica: visitas, tratamientos, medicación, vacunas, cirugías, laboratorios, peso |
| calendar / citas | (sin documentación disponible) | Citas y disponibilidad |
| notification-microservice-pubsub | (sin documentación disponible) | Email, push y, a futuro, WhatsApp a partir de eventos |
| IA-service | (sin documentación disponible) | Pre-análisis de documentos de verificación, resúmenes clínicos |

### Estado actual de veterinary-service

Ya existen 16 casos de uso: `RegisterVeterinary`, `GenerateInviteCode`, `DeActivate`, `Activate`, `UpdateVeterinary`, `CreateVeterinaryEmployee`, `UpdateEmployeeRole`, `ActivateEmployee`, `DeactivateEmployee`, `GetActivePlan`, `IsExpired`, `CreatePlan`, `UpdatePlan`, `LinkByCode`, `LinkByUrl`, `Unlink`.

Brechas conocidas en todo el ecosistema:

- `SecurityConfig` hace `permitAll()` en Pets y Veterinary; la identidad viaja en bodies (`userId`, `ownerId`). Medical tampoco valida tokens.
- Existe `JWT_SECRET` (HS256) configurado pero sin uso.
- Veterinary no publica eventos.
- Medical no sabe qué clínica ni qué empleado atendió.
- Los tests de Veterinary dependen de la base real de Supabase.

### Contexto de mercado

El software veterinario en Latinoamérica es un mercado competido y de precios bajos (en Colombia, aproximadamente $70.000 a $300.000 COP mensuales; competidores como GVET, Okvet, QVET, VeteSoft, Pegazoo, ACVet). GVET ya ofrece una app gratuita para los clientes de la clínica. Un estudio de Pet Industry Academy en Colombia reportó que el 80% de los centros veterinarios usa software y el 43% considera cambiarlo.

**Diferencial de MyAnimaLog:** la historia de la mascota pertenece al dueño y viaja con ella entre clínicas. Para la clínica significa recibir pacientes nuevos con historia, conseguir clientes desde el directorio y las citas en la app, y reducir inasistencias. Además, solo veterinarios con tarjeta profesional verificada pueden escribir historia clínica.

**Brechas de producto frente a la competencia (fases posteriores):** caja y facturación electrónica (DIAN, vía proveedor como Alegra o Siigo), inventario, hospitalización, documentos imprimibles (fórmula, carnet de vacunas, certificados, consentimientos), WhatsApp, importación de datos desde otros sistemas.

---

## 2. Decisiones de arquitectura

1. **Separación de responsabilidades.** Pets es dueño de la mascota y su dueño; Medical de lo que pasó clínicamente; Veterinary de quién atiende, dónde, cuándo y con permiso de quién. Veterinary **no** guarda historia clínica.
2. **Seguridad y multi-tenant.** User service firma JWT con RS256 y publica JWKS. Todos los servicios validan el token por sí mismos. Existe un token de contexto de clínica con `vet_id`, `vet_role`, `employee_id`, `vet_licensed`, `vet_status`. Si la ruta trae un `veterinaryId` distinto al `vet_id` del token → 403.
3. **Roles en el token, permisos en el código.** Cinco roles (`OWNER`, `ADMIN`, `VETERINARIAN`, `ASSISTANT`, `RECEPTIONIST`) más `PLATFORM_ADMIN` para el equipo de MyAnimaLog. La traducción rol → permisos vive en el dominio de Veterinary.
4. **Licencia profesional como requisito de escritura clínica.** `CLINICAL_WRITE` y `NURSING_WRITE` solo con tarjeta profesional verificada.
5. **Consentimiento por mascota.** La clínica solo ve las mascotas que el dueño le compartió (`VeterinaryPatient`). El dueño puede revocar.
6. **Dueños sin app.** La clínica registra la mascota con los datos de contacto del dueño (Pets acepta `owner_id` nulo). Luego envía una invitación para reclamarla; al aceptarla, la mascota pasa a la cuenta del dueño. Así cada clínica trae usuarios a la app.
7. **Cita vs. visita.** La cita (agenda) vive en Calendar; la visita (registro clínico) vive en Medical y se crea cuando la cita se atiende.
8. **Fuente única de permisos.** Pets, Medical y Calendar no duplican la matriz: preguntan a Veterinary con `GET /internal/veterinaries/{id}/patients/{petId}/access`.
9. **Eventos con sobre único** (`eventType`, `userId`, `recipient`, `payload`, `occurredAt`, `metadata`), con `userId` = destinatario.
10. **Organización por módulos** dentro del hexágono de Veterinary: `clinic`, `verification`, `professional`, `staff`, `patients`, `catalog`, `subscription`.

---

## 3. Qué podrá hacer una veterinaria

| Área | La veterinaria puede… | Dónde vive |
|---|---|---|
| Cuenta y clínica | Registrarse, verificarse, iniciar prueba gratis | Veterinary + User |
| | Iniciar sesión y elegir clínica | User + Veterinary |
| | Editar perfil, logo, ubicación, configuración | Veterinary |
| | Aparecer en el directorio de la app | Veterinary |
| | Generar, regenerar o revocar su código/QR de vinculación | Veterinary |
| Equipo | Invitar empleados por email con un rol | Veterinary + Notificaciones |
| | Cambiar roles, activar/desactivar, transferir propiedad | Veterinary |
| | Registrar y verificar el perfil profesional de cada veterinario | Veterinary (+ IA de apoyo) |
| | Definir horarios por veterinario y bloqueos | Veterinary |
| Clientes y pacientes | Recibir dueños vinculados por código/QR | Veterinary |
| | Ver las mascotas compartidas | Veterinary + Pets |
| | Registrar pacientes cuyo dueño no tiene app | Pets + Veterinary |
| | Invitar al dueño a reclamar la mascota | Pets + Notificaciones |
| | Buscar pacientes por mascota, dueño o teléfono | Veterinary |
| | Ver ficha completa: datos, documentos, historia | Pets + Medical |
| Agenda | Catálogo de servicios con duración y precio | Veterinary |
| | Horario de atención | Veterinary |
| | Disponibilidad, crear, confirmar, reprogramar, cancelar, check-in, atendida, no asistió | Calendar |
| | Recibir solicitudes de cita desde la app | Calendar |
| Atención clínica | Visitas, tratamientos, medicación, vacunas, cirugías, laboratorios, peso | Medical |
| | Subir documentos de la mascota | Pets |
| Comunicación | Confirmaciones y recordatorios de citas y vacunas | Notificaciones |
| Negocio | Plan, pago, renovación, cancelación | Veterinary + Wompi |
| | Reportes (fase posterior) | Veterinary |
| | Resumen con IA antes de la cita (fase posterior) | IA-service |

---

## 4. Validación del registro de veterinarias

**Decisión: híbrido. La IA pre-analiza, una persona decide.**

- **Por qué no solo IA:** puede leer un documento editado y extraer datos coherentes; no puede saber si la tarjeta es real. Eso solo lo confirma el registro oficial de COMVEZCOL (Consejo Profesional de Medicina Veterinaria y de Zootecnia de Colombia), que publica consultas de profesionales habilitados, extranjeros con registro y sancionados. La responsabilidad de aprobar a quien firmará historias clínicas no se delega a un modelo.
- **Por qué no solo manual:** a mano se escapan inconsistencias (NIT distinto entre RUT y Cámara de Comercio, nombres que no coinciden). La IA las detecta en segundos.

**Flujo:**

1. La clínica se registra → `PENDING_DOCUMENTS`. Puede configurar e invitar personal, pero no atender.
2. Sube documentos de la clínica (RUT, Cámara de Comercio, cédula del representante legal). Cada veterinario sube su tarjeta profesional y cédula; la licencia es de la persona, se verifica una sola vez aunque trabaje en varias clínicas.
3. Al enviar, la IA analiza en segundo plano: tipo de documento, legibilidad, coincidencia de NIT y nombres, actividad del RUT, vigencia del certificado. Entrega nivel de riesgo y resumen. Solo puede recomendar "listo para revisión" o "requiere atención", nunca aprobar ni rechazar. Si falla, la revisión humana sigue igual.
4. Un `PLATFORM_ADMIN` revisa documentos (URLs firmadas de 10 min), el reporte de la IA y consulta el portal de COMVEZCOL. "Aprobar" exige marcar que se verificó en el registro oficial; queda guardado quién y cuándo.
5. Decide: aprobar, rechazar con motivo o pedir corrección. Al aprobar: `ACTIVE`, inicia la prueba de 30 días y los veterinarios verificados obtienen escritura clínica.

No se automatiza la consulta a COMVEZCOL: no hay API pública conocida y el scraping es frágil y probablemente contrario a sus términos. Los documentos van en bucket privado y el aviso de tratamiento de datos debe mencionar el análisis con IA.

---

## 5. Orden de trabajo entre repos

```
USER-01, USER-02 (JWT RS256 + JWKS)
   └─▶ VET Fase 0 y 1 (bases + seguridad)
         └─▶ VET-11 ─▶ USER-03, USER-04 (token de clínica)
               └─▶ VET Fase 2 (clínica, roles, verificación) ◀── IA-01 en paralelo
                     └─▶ USER-06 ─▶ VET Fase 3 (personal)
                           └─▶ PETS-01…06 ─▶ VET Fase 4 (pacientes) ─▶ VET-29 (endpoint access)
                                 ├─▶ MED-01…07
                                 └─▶ VET Fase 5 (catálogo, horarios) ─▶ CAL-01…06
NOTIF-01…06 en paralelo desde que existan los primeros eventos
VET Fase 6 (suscripción) al final
```


---

## 6. Contratos compartidos


> Copia este archivo **igual** en todos los repos (user, pets, veterinary, medical, notifications, ia, calendar).
> Si un contrato cambia, se cambia aquí primero y se replica. Ningún servicio inventa su propia versión.

---

### 1. JWT

#### 1.1 Firma

- Algoritmo: **RS256** (asimétrico). Solo el **User service** tiene la llave privada y firma tokens.
- Los demás servicios **solo verifican** con la llave pública publicada en:
  `GET {USER_SERVICE_URL}/.well-known/jwks.json`
- Cada llave lleva `kid`. Los verificadores deben cachear el JWKS (5–10 min) y refrescarlo si llega un `kid` desconocido.
- `iss` = `myanimalog-user-service`
- `aud` = `myanimalog-api`
- El `JWT_SECRET` (HS256) que existe hoy en Pets y Veterinary **se elimina** al terminar la migración.

#### 1.2 Token base (cualquier usuario que inicia sesión)

```json
{
  "iss": "myanimalog-user-service",
  "aud": "myanimalog-api",
  "sub": "8f1c…-uuid-del-usuario",
  "email": "ana@correo.com",
  "email_verified": true,
  "platform_role": "USER",
  "ctx": "USER",
  "iat": 1790891292,
  "exp": 1790892192,
  "jti": "uuid-del-token"
}
```

| Claim | Valores | Uso |
|---|---|---|
| `sub` | uuid | Identidad del usuario. **Reemplaza** todo `userId`/`ownerId`/`uploadedBy` que hoy viaja en bodies o query params |
| `platform_role` | `USER` \| `PLATFORM_ADMIN` | `PLATFORM_ADMIN` = equipo MyAnimaLog (aprueba clínicas, soporte) |
| `ctx` | `USER` \| `VETERINARY` | Tipo de token |
| `email_verified` | bool | Obligatorio `true` para aceptar invitaciones |
| `exp` | — | **15 minutos** de vida |

#### 1.3 Token de contexto de clínica

Se obtiene con `POST /auth/context/veterinary/{veterinaryId}` en el User service (ver `USER_SERVICE_CHANGES.md`).
Lleva todo lo del token base más:

```json
{
  "ctx": "VETERINARY",
  "vet_id": "uuid-clinica",
  "vet_role": "VETERINARIAN",
  "employee_id": "uuid-empleado",
  "vet_licensed": true,
  "vet_status": "ACTIVE"
}
```

| Claim | Valores |
|---|---|
| `vet_role` | `OWNER` \| `ADMIN` \| `VETERINARIAN` \| `ASSISTANT` \| `RECEPTIONIST` |
| `vet_licensed` | `true` si el perfil profesional del usuario está `VERIFIED` (tarjeta profesional aprobada) |
| `vet_status` | `PENDING_DOCUMENTS` \| `UNDER_REVIEW` \| `NEEDS_CORRECTION` \| `ACTIVE` \| `REJECTED` \| `SUSPENDED` |

#### 1.4 Refresh token

- Opaco (no JWT), guardado **hasheado** en la BD del User service, vida 30 días, **rotación** en cada uso.
- Refrescar un token de clínica **vuelve a consultar** a Veterinary (rol, estado, licencia). Por eso un cambio de rol o una desactivación aplica en máximo 15 minutos.

#### 1.5 Regla obligatoria en todo servicio que reciba un token de clínica

Si la ruta o el body trae un `veterinaryId`, **debe ser igual a `vet_id` del token**. Si no → `403`.
Esto es lo que impide que una clínica lea datos de otra.

---

### 2. Autenticación servicio a servicio

- Rutas bajo `/internal/**` **no** aceptan JWT de usuario. Requieren el header:
  `X-Internal-Api-Key: <INTERNAL_API_KEY>`
- La variable `INTERNAL_API_KEY` es la misma en todos los servicios (MVP). En producción en Cloud Run se puede migrar a ID tokens de IAM.
- Las rutas `/internal/**` nunca se exponen por el gateway.
- Timeout de llamadas internas: 3 s. Si el servicio llamado no responde → el que llama responde `503`, nunca "deja pasar".

---

### 3. Endpoint de acceso (el más usado de todo el ecosistema)

Veterinary es la **única fuente de verdad** sobre qué puede hacer un empleado sobre una mascota.
Pets, Medical y Calendar **no** duplican la tabla de permisos: preguntan aquí.

```
GET {VETERINARY_SERVICE_URL}/internal/veterinaries/{veterinaryId}/patients/{petId}/access?userId={userId}
X-Internal-Api-Key: …
```

Respuesta `200`:

```json
{
  "hasAccess": true,
  "veterinaryStatus": "ACTIVE",
  "employeeId": "uuid",
  "role": "VETERINARIAN",
  "licensed": true,
  "permissions": ["CLINICAL_READ", "CLINICAL_WRITE", "NURSING_WRITE", "DOCUMENT_UPLOAD", "APPOINTMENT_MANAGE", "PATIENT_REGISTER"]
}
```

- `hasAccess = false` si: el usuario no es empleado activo, la clínica no está `ACTIVE`, o la mascota no está compartida con la clínica (consentimiento revocado o inexistente).
- Los consumidores pueden cachear la respuesta **60 segundos** por `(veterinaryId, petId, userId)`.

#### 3.1 Catálogo de permisos

| Permiso | Qué habilita |
|---|---|
| `CLINIC_CONFIGURE` | Perfil, logo, configuración, horarios, catálogo de servicios |
| `SUBSCRIPTION_MANAGE` | Plan, pagos, cancelación |
| `STAFF_MANAGE` | Invitar, cambiar rol, activar/desactivar empleados |
| `APPOINTMENT_MANAGE` | Crear, confirmar, reprogramar, cancelar, check-in de citas |
| `PATIENT_REGISTER` | Registrar pacientes sin app, invitar a reclamar |
| `CLINICAL_READ` | Leer historia clínica completa |
| `CLINICAL_READ_BASIC` | Leer datos básicos (nombre, especie, alergias, próxima cita) |
| `CLINICAL_WRITE` | Visitas, diagnóstico, tratamientos, medicación, cirugías, laboratorios |
| `NURSING_WRITE` | Peso, signos, aplicar vacuna |
| `DOCUMENT_UPLOAD` | Subir documentos a la mascota |
| `REPORTS_VIEW` | Reportes del negocio |

#### 3.2 Matriz rol → permisos

| Permiso | OWNER | ADMIN | VETERINARIAN | ASSISTANT | RECEPTIONIST |
|---|:-:|:-:|:-:|:-:|:-:|
| CLINIC_CONFIGURE | ✅ | ✅ | | | |
| SUBSCRIPTION_MANAGE | ✅ | | | | |
| STAFF_MANAGE | ✅ | ✅ | | | |
| APPOINTMENT_MANAGE | ✅ | ✅ | ✅ | ✅ | ✅ |
| PATIENT_REGISTER | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLINICAL_READ | ✅ | ✅ | ✅ | ✅ | |
| CLINICAL_READ_BASIC | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLINICAL_WRITE | 🔑 | 🔑 | 🔑 | | |
| NURSING_WRITE | 🔑 | 🔑 | ✅ | ✅ | |
| DOCUMENT_UPLOAD | ✅ | ✅ | ✅ | ✅ | |
| REPORTS_VIEW | ✅ | ✅ | | | |

🔑 = solo si `licensed = true` (tarjeta profesional verificada). Un `VETERINARIAN` sin licencia verificada **no** tiene `CLINICAL_WRITE` ni `NURSING_WRITE` hasta que se apruebe.

Además, si `veterinaryStatus != ACTIVE`, la clínica solo conserva `CLINIC_CONFIGURE`, `STAFF_MANAGE` y `SUBSCRIPTION_MANAGE` (puede prepararse mientras la revisan, pero no atender).

---

### 4. Eventos (Google Cloud Pub/Sub)

#### 4.1 Sobre único para todos los servicios

```json
{
  "eventType": "APPOINTMENT_CONFIRMED",
  "userId": "uuid-del-destinatario-o-null",
  "recipient": {
    "email": "dueño@correo.com",
    "phone": "+573001234567",
    "name": "Carlos Pérez"
  },
  "payload": { "...": "datos propios del evento" },
  "occurredAt": "2026-10-01T15:04:05Z",
  "metadata": {
    "version": "1.0",
    "source": "veterinary-service",
    "veterinaryId": "uuid-o-null",
    "correlationId": "uuid"
  }
}
```

Reglas:

1. `userId` = **a quién se le notifica** (no quién hizo la acción). Si el destinatario no tiene cuenta (dueño sin app), `userId = null` y `recipient` es obligatorio.
2. Si `userId` y `recipient` vienen ambos vacíos, el evento es inválido: **no se publica** (se loguea error en el emisor).
3. `payload` lleva todo lo que la notificación necesita para armarse **sin** tener que llamar a otro servicio (nombre de mascota, nombre de clínica, fecha de cita…).
4. Un fallo al publicar **nunca** tumba la respuesta HTTP (mismo patrón que Medical: `try/catch` separado + log).
5. Pets hoy publica un `PetEvent` sin detalle: se migra a este sobre (ver `PETS_SERVICE_CHANGES.md`).

#### 4.2 Topics por servicio

| Servicio | Topics |
|---|---|
| Veterinary | `veterinary-clinic`, `veterinary-verification`, `veterinary-staff`, `veterinary-patients`, `veterinary-subscription` |
| Calendar (o Veterinary si la agenda vive allí) | `veterinary-appointments` |
| Pets | los actuales `pet-*` + `pet-claim-invitation-sent`, `pet-claimed` |
| Medical | los actuales `medical-pet-*` (sin cambios de nombre) |

Suscripciones del servicio de notificaciones: `sub-notificaciones-<topic>`.

---

### 5. Convenciones HTTP

- Errores con el formato que ya usa Veterinary: `{ "timestamp", "status", "error", "message" }`.
- `401` = token ausente, vencido o firma inválida. `403` = token válido pero sin permiso / otra clínica.
- Si hay gateway, cada servicio tiene prefijo propio: `/api/users/**`, `/api/pets/**`, `/api/veterinary/**`, `/api/medical/**`, `/api/calendar/**`. Aunque haya gateway, **cada servicio valida el JWT por sí mismo** (el gateway es opcional, la seguridad no).
- Fechas en ISO-8601 UTC. Zona horaria de negocio por clínica (default `America/Bogota`).

---

## 7. Plan del veterinary-service


> Documento para el repo `veterinary-service`. Léelo junto con `CLAUDE.md` (arquitectura actual) y `CONTRATOS_COMPARTIDOS.md` (JWT, permisos, eventos).
> Las tareas tienen ID (`VET-xx`). Las que dependen de otro repo lo indican (`requiere USER-03`).
> Mantén las convenciones del repo: hexagonal, un caso de uso por operación (`<Verb><Noun>UseCase` / `Service` / `Controller` / `Request` / `Response`), una excepción de dominio por regla, handler en `GlobalExceptionHandler`, un test por clase.

---

### 0. Qué es este servicio y qué NO es

**Es dueño de:** la clínica (tenant), su verificación legal, su personal y roles, el perfil profesional de los veterinarios, la vinculación con dueños, el consentimiento por mascota, el catálogo de servicios, los horarios y la suscripción SaaS.

**NO es dueño de (y nunca guarda copia de):**

| Dato | Dueño | Cómo lo obtiene Veterinary |
|---|---|---|
| Cuenta, nombre, email del usuario | User service | `UserServicePort` (HTTP interno) |
| Mascota, foto, documentos | Pets | `PetsServicePort` (HTTP interno) |
| Historia clínica (visitas, vacunas, cirugías…) | Medical | No la lee. El front la pide a Medical, y Medical le pregunta permisos a Veterinary |
| Citas | Calendar (ver §10) | `CalendarServicePort` o módulo propio |
| Envío de emails/push/WhatsApp | Notifications | Publica eventos a Pub/Sub |
| Análisis de documentos con IA | IA service | `IaVerificationPort` (HTTP interno) |

Excepción deliberada: `veterinary_patients` guarda un **snapshot** de `pet_name`, `owner_name`, `owner_phone` solo para poder buscar pacientes rápido (§7.3). Se refresca al compartir y al registrar.

---

### 1. Qué pasa con lo que ya existe

| Caso de uso actual | Decisión | Detalle |
|---|---|---|
| `RegisterVeterinary` | 🔧 Modificar | Toma el creador del token, crea al creador como empleado `OWNER`, estado inicial `PENDING_DOCUMENTS`, campos nuevos (NIT, dirección, coordenadas…) |
| `GenerateInviteCode` | ✅ Mantener | Agregar `RevokeInviteCode` |
| `Activate` / `DeActivate` | 🔧 Mover | Pasan a `/admin/veterinaries/{id}/reactivate` y `/suspend`, solo `PLATFORM_ADMIN`. Operan sobre `status`, no sobre el booleano `active` |
| `UpdateVeterinary` | ✅ Mantener | Requiere `CLINIC_CONFIGURE` |
| `CreateVeterinaryEmployee` | 🔁 Reemplazar | Deja de ser endpoint público. Se reemplaza por invitaciones (§6). El servicio interno se reutiliza al aceptar una invitación |
| `UpdateEmployeeRole` | 🔧 Modificar | Requiere `STAFF_MANAGE`. No se puede asignar `OWNER` por aquí. `ADMIN` no puede modificar a un `OWNER` |
| `ActivateEmployee` / `DeactivateEmployee` | 🔧 Modificar | Requiere `STAFF_MANAGE`. El `OWNER` no se puede desactivar |
| `GetActivePlan` / `IsExpired` | ✅ Mantener | Requiere ser miembro de la clínica |
| `CreatePlan` / `UpdatePlan` | 🔧 Mover | Pasan a `/admin/**` (para dar planes manuales a pilotos). La compra normal va por checkout (§9) |
| `LinkByCode` / `LinkByUrl` | 🔁 Unificar | Un solo `LinkToVeterinary` que recibe el código. La URL solo lleva el código dentro |
| `Unlink` | 🔧 Modificar | Desde ambos lados. Al desvincular se revocan todas las mascotas compartidas |

---

### 2. Estructura de paquetes objetivo

Reorganizar por módulo **antes** de agregar funcionalidades (VET-02). Dentro de cada módulo se conserva la división hexagonal.

```
com.myanimalog.veterinary
├── domain
│   ├── clinic/           Veterinary, VeterinaryStatus, VeterinarySettings, exceptions
│   ├── verification/     VerificationRequest, VerificationDocument, DocumentType, VerificationStatus
│   ├── professional/     ProfessionalProfile, LicenseStatus
│   ├── staff/            VeterinaryEmployee, EmployeeRole, EmployeeInvitation, InvitationStatus
│   ├── patients/         UserVeterinaryLink, VeterinaryPatient, PatientOrigin, ConsentStatus
│   ├── catalog/          VeterinaryService (servicio ofrecido), BusinessHours, EmployeeSchedule, ScheduleBlock
│   ├── subscription/     SubscriptionPlan, VeterinarySubscription, SubscriptionStatus, Payment
│   └── security/         Permission, RolePermissions   ← sin Spring
├── application
│   ├── <módulo>/ports/in, ports/out, services, dto     (mismo patrón actual, por módulo)
│   └── shared/ports/out  AuthenticatedUserPort, EventPublisherPort, FileStoragePort,
│                          UserServicePort, PetsServicePort, IaVerificationPort, CalendarServicePort
└── infrastructure
    ├── <módulo>/controllers, adapters, repositories, entity, mapper
    ├── security/          SecurityConfig, JwtClaimsConverter, InternalApiKeyFilter, SpringAuthenticatedUserAdapter
    ├── clients/           RestClient adapters hacia user, pets, ia, calendar
    ├── messaging/         GooglePubSubEventAdapter
    ├── storage/           SupabaseStorageAdapter (logo público, documentos privados)
    ├── jobs/              endpoints /internal/jobs/** para Cloud Scheduler
    └── config/            GlobalExceptionHandler, RestClientConfig, OpenApiConfig
```

---

### 3. Base de datos (Flyway)

Hoy el esquema se maneja a mano (`ddl-auto: none`). Agregar Flyway con `baseline-on-migrate: true` para no romper las tablas existentes.

> Ajusta los nombres de las tablas actuales a los reales antes de correr (`veterinaries`, `veterinary_employees`, `veterinary_subscriptions`, `user_veterinary_links` son los asumidos).

#### V2__clinic_status_and_profile.sql

```sql
ALTER TABLE veterinaries
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING_DOCUMENTS',
  ADD COLUMN legal_name VARCHAR(200),
  ADD COLUMN nit VARCHAR(20),
  ADD COLUMN phone VARCHAR(30),
  ADD COLUMN address VARCHAR(250),
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN department VARCHAR(100),
  ADD COLUMN latitude NUMERIC(9,6),
  ADD COLUMN longitude NUMERIC(9,6),
  ADD COLUMN logo_url TEXT,
  ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  ADD COLUMN default_appointment_minutes INT NOT NULL DEFAULT 30,
  ADD COLUMN allow_online_booking BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN booking_requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN cancellation_min_hours INT NOT NULL DEFAULT 4,
  ADD COLUMN directory_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN created_by UUID,
  ADD COLUMN approved_at TIMESTAMPTZ;

-- Migrar el booleano existente
UPDATE veterinaries SET status = CASE WHEN active THEN 'ACTIVE' ELSE 'SUSPENDED' END;
CREATE UNIQUE INDEX ux_veterinaries_nit ON veterinaries(nit) WHERE nit IS NOT NULL;
CREATE INDEX ix_veterinaries_city ON veterinaries(city) WHERE status = 'ACTIVE';
```

#### V3__employee_roles.sql

```sql
ALTER TABLE veterinary_employees DROP CONSTRAINT IF EXISTS veterinary_employees_role_check;
ALTER TABLE veterinary_employees ADD CONSTRAINT veterinary_employees_role_check
  CHECK (role IN ('OWNER','ADMIN','VETERINARIAN','ASSISTANT','RECEPTIONIST'));
-- exactamente un OWNER activo por clínica
CREATE UNIQUE INDEX ux_one_owner_per_vet ON veterinary_employees(veterinary_id) WHERE role = 'OWNER';
CREATE UNIQUE INDEX ux_employee_user_per_vet ON veterinary_employees(veterinary_id, user_id);
```

#### V4__professional_profiles.sql

La licencia es de la **persona**, no del empleo: un veterinario que trabaja en dos clínicas se verifica una sola vez.

```sql
CREATE TABLE professional_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  document_type VARCHAR(10) NOT NULL,          -- CC, CE, PPT
  document_number VARCHAR(30) NOT NULL,
  license_number VARCHAR(50) NOT NULL,         -- número de tarjeta / matrícula profesional
  profession VARCHAR(10) NOT NULL,             -- MV, MVZ
  specialty VARCHAR(120),
  university VARCHAR(200),
  signature_url TEXT,                          -- firma para fórmulas y certificados (bucket privado)
  license_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SUBMITTED', -- NOT_SUBMITTED, PENDING, VERIFIED, REJECTED
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_profile_license ON professional_profiles(license_number);
```

#### V5__verification.sql

```sql
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY,
  subject_type VARCHAR(20) NOT NULL,           -- CLINIC, PROFESSIONAL
  subject_id UUID NOT NULL,                    -- veterinary_id o professional_profile_id
  status VARCHAR(30) NOT NULL,                 -- DRAFT, UNDER_REVIEW, NEEDS_CORRECTION, APPROVED, REJECTED
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ,
  ai_status VARCHAR(20) NOT NULL DEFAULT 'NOT_RUN',  -- NOT_RUN, RUNNING, DONE, FAILED
  ai_report JSONB,                             -- respuesta del IA service, solo de apoyo
  ai_risk_level VARCHAR(10),                   -- LOW, MEDIUM, HIGH
  reviewer_id UUID,
  reviewer_notes TEXT,
  decided_at TIMESTAMPTZ,
  registry_checked BOOLEAN NOT NULL DEFAULT FALSE,  -- el admin confirmó en el portal oficial
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_verif_status ON verification_requests(status, submitted_at);

CREATE TABLE verification_documents (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  document_type VARCHAR(40) NOT NULL,
  storage_path TEXT NOT NULL,                  -- bucket PRIVADO, nunca URL pública
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,                 -- detectar el mismo archivo subido por dos clínicas
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Tipos de documento (`DocumentType`):

| Para | Documentos |
|---|---|
| `CLINIC` | `RUT`, `CHAMBER_OF_COMMERCE` (certificado de existencia y representación legal, o matrícula mercantil si es persona natural), `LEGAL_REP_ID` (cédula del representante), `FACADE_PHOTO` (opcional) |
| `PROFESSIONAL` | `PROFESSIONAL_CARD` (tarjeta o certificado de registro), `ID_DOCUMENT`, `DEGREE` (opcional) |

#### V6__employee_invitations.sql

```sql
CREATE TABLE employee_invitations (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  email VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL,
  token UUID NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL,                 -- PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED
  invited_by UUID NOT NULL,
  accepted_user_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_pending_invite ON employee_invitations(veterinary_id, lower(email)) WHERE status = 'PENDING';
```

#### V7__patients.sql

```sql
ALTER TABLE user_veterinary_links ADD COLUMN unlinked_at TIMESTAMPTZ;

CREATE TABLE veterinary_patients (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  pet_id UUID NOT NULL,
  origin VARCHAR(20) NOT NULL,                 -- SHARED_BY_OWNER, REGISTERED_BY_CLINIC
  consent_status VARCHAR(20) NOT NULL,         -- GRANTED, REVOKED
  granted_by UUID,                             -- null si lo registró la clínica (dueño sin cuenta)
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  pet_name VARCHAR(120) NOT NULL,              -- snapshot para búsqueda
  species VARCHAR(50),
  owner_name VARCHAR(200),
  owner_phone VARCHAR(30),
  owner_email VARCHAR(200),
  UNIQUE (veterinary_id, pet_id)
);
CREATE INDEX ix_patients_search ON veterinary_patients
  USING gin (to_tsvector('spanish', coalesce(pet_name,'') || ' ' || coalesce(owner_name,'')));
CREATE INDEX ix_patients_phone ON veterinary_patients(veterinary_id, owner_phone);
```

#### V8__catalog_schedule.sql

```sql
CREATE TABLE clinic_services (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(30) NOT NULL,               -- CONSULTATION, VACCINATION, SURGERY, GROOMING, LAB, OTHER
  duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 5 AND 600),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  bookable_online BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (veterinary_id, name)
);

CREATE TABLE business_hours (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL CHECK (closes_at > opens_at)
);

CREATE TABLE employee_schedules (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL CHECK (ends_at > starts_at)
);

CREATE TABLE schedule_blocks (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  employee_id UUID,                            -- null = bloquea toda la clínica (festivo)
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  reason VARCHAR(200)
);
```

#### V9__subscription_plans.sql

```sql
CREATE TABLE subscription_plans (
  code VARCHAR(30) PRIMARY KEY,                -- FREE, BASIC, PRO
  name VARCHAR(60) NOT NULL,
  monthly_price NUMERIC(12,2) NOT NULL,
  yearly_price NUMERIC(12,2) NOT NULL,
  max_employees INT,                           -- null = ilimitado
  max_patients INT,
  features JSONB NOT NULL,                     -- ["ONLINE_BOOKING","WHATSAPP","REPORTS","AI_SUMMARY"]
  active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE veterinary_subscriptions
  ADD COLUMN plan_code VARCHAR(30) REFERENCES subscription_plans(code),
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- TRIAL, ACTIVE, GRACE, EXPIRED, CANCELLED
  ADD COLUMN billing_period VARCHAR(10),                    -- MONTHLY, YEARLY
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  subscription_id UUID,
  provider VARCHAR(20) NOT NULL,               -- WOMPI
  provider_reference VARCHAR(100) NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL,                 -- PENDING, APPROVED, DECLINED, ERROR
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 4. Seguridad (VET-03 … VET-08)

#### 4.1 Dependencias

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.security</groupId>
  <artifactId>spring-security-test</artifactId>
  <scope>test</scope>
</dependency>
```

Eliminar `jjwt` y `jwt.secret` cuando todo funcione con JWKS.

#### 4.2 application.yaml

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: ${JWT_JWKS_URI}          # http://user-service/.well-known/jwks.json
          issuer-uri:                            # vacío: validamos iss manualmente
app:
  security:
    issuer: myanimalog-user-service
    audience: myanimalog-api
    internal-api-key: ${INTERNAL_API_KEY}
```

#### 4.3 SecurityConfig

```java
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

  private final InternalApiKeyFilter internalApiKeyFilter;

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
      .csrf(AbstractHttpConfigurer::disable)
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/api-docs/**",
                         "/actuator/health", "/actuator/info").permitAll()
        .requestMatchers("/public/**").permitAll()
        .requestMatchers(HttpMethod.POST, "/webhooks/payments/**").permitAll() // valida firma propia
        .requestMatchers("/internal/**").hasAuthority("INTERNAL_SERVICE")
        .requestMatchers("/admin/**").hasAuthority("PLATFORM_ADMIN")
        .anyRequest().authenticated())
      .addFilterBefore(internalApiKeyFilter, BearerTokenAuthenticationFilter.class)
      .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(new JwtClaimsConverter())))
      .build();
  }

  @Bean
  JwtDecoder jwtDecoder(@Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwks,
                        @Value("${app.security.issuer}") String iss,
                        @Value("${app.security.audience}") String aud) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
        JwtValidators.createDefaultWithIssuer(iss),
        new JwtClaimValidator<List<String>>("aud", a -> a != null && a.contains(aud))));
    return decoder;
  }
}
```

- `JwtClaimsConverter`: convierte el JWT en `JwtAuthenticationToken` con autoridades `PLATFORM_ADMIN` (si `platform_role` lo es) y `VET_ROLE_<rol>` (si `ctx = VETERINARY`).
- `InternalApiKeyFilter`: si la ruta empieza por `/internal/` y el header `X-Internal-Api-Key` coincide (comparación en tiempo constante, `MessageDigest.isEqual`), pone una autenticación con autoridad `INTERNAL_SERVICE`. Si no coincide → `401`.

#### 4.4 Puerto del usuario autenticado (mantiene el dominio libre de Spring)

```java
// application/shared/ports/out
public interface AuthenticatedUserPort {
  AuthenticatedUser current();                 // lanza UnauthenticatedException si no hay
}

// application/shared/dto
public record AuthenticatedUser(
    UUID userId, String email, boolean emailVerified, boolean platformAdmin,
    Optional<ClinicContext> clinic) {}

public record ClinicContext(UUID veterinaryId, UUID employeeId, EmployeeRole role,
                            boolean licensed, VeterinaryStatus status) {}
```

`SpringAuthenticatedUserAdapter` (infraestructura) lo implementa leyendo `SecurityContextHolder`.

#### 4.5 Permisos en el dominio

```java
// domain/security
public enum Permission {
  CLINIC_CONFIGURE, SUBSCRIPTION_MANAGE, STAFF_MANAGE, APPOINTMENT_MANAGE, PATIENT_REGISTER,
  CLINICAL_READ, CLINICAL_READ_BASIC, CLINICAL_WRITE, NURSING_WRITE, DOCUMENT_UPLOAD, REPORTS_VIEW
}

public final class RolePermissions {
  private static final Set<Permission> PRE_APPROVAL =
      EnumSet.of(CLINIC_CONFIGURE, STAFF_MANAGE, SUBSCRIPTION_MANAGE);

  public static Set<Permission> resolve(EmployeeRole role, boolean licensed, VeterinaryStatus status) {
    Set<Permission> p = EnumSet.copyOf(base(role));
    if (licensed && EnumSet.of(OWNER, ADMIN, VETERINARIAN).contains(role)) {
      p.add(CLINICAL_WRITE);
      p.add(NURSING_WRITE);
    }
    if (!licensed && role == VETERINARIAN) {
      p.remove(CLINICAL_WRITE);
      p.remove(NURSING_WRITE);
    }
    if (status != VeterinaryStatus.ACTIVE) p.retainAll(PRE_APPROVAL);
    return p;
  }
  // base(role): implementa la matriz de CONTRATOS_COMPARTIDOS.md §3.2
}
```

Test obligatorio: `RolePermissionsTest` con un caso por celda de la matriz.

#### 4.6 Servicio de autorización

```java
// application/shared/services
@Service
@RequiredArgsConstructor
public class VeterinaryAuthorizationService {
  private final AuthenticatedUserPort auth;

  /** Para operaciones de personal de la clínica. */
  public ClinicContext require(UUID veterinaryIdFromPath, Permission permission) {
    ClinicContext ctx = auth.current().clinic()
        .orElseThrow(ClinicContextRequiredException::new);              // 403
    if (!ctx.veterinaryId().equals(veterinaryIdFromPath))
      throw new TenantMismatchException();                             // 403
    if (!RolePermissions.resolve(ctx.role(), ctx.licensed(), ctx.status()).contains(permission))
      throw new InsufficientPermissionException(permission);           // 403
    return ctx;
  }

  /** Para operaciones que solo requieren ser miembro (cualquier rol). */
  public ClinicContext requireMember(UUID veterinaryIdFromPath) { … }
}
```

Los claims del token pueden tener hasta 15 minutos de antigüedad. Para operaciones sensibles (`STAFF_MANAGE`, `SUBSCRIPTION_MANAGE`, transferir propiedad) el servicio **vuelve a leer** el empleado de la BD antes de actuar.

#### 4.7 Excepciones nuevas → `GlobalExceptionHandler`

| Excepción | HTTP |
|---|---|
| `UnauthenticatedException` | 401 |
| `ClinicContextRequiredException`, `TenantMismatchException`, `InsufficientPermissionException` | 403 |
| `PlatformAdminRequiredException` | 403 |
| `ClinicNotActiveException` | 409 |
| `PlanLimitReachedException` | 402 |
| `FeatureNotInPlanException` | 402 |

---

### 5. Módulo clínica + verificación

#### 5.1 Ciclo de vida de la clínica

```
PENDING_DOCUMENTS ──submit──▶ UNDER_REVIEW ──approve──▶ ACTIVE ──suspend──▶ SUSPENDED
        ▲                          │                       ▲                     │
        └──── NEEDS_CORRECTION ◀───┤ request-correction    └─────reactivate──────┘
                                   └──reject──▶ REJECTED
```

- Mientras no esté `ACTIVE`: puede configurar perfil, logo, horarios, catálogo e invitar personal. **No** puede vincular dueños, registrar pacientes, recibir citas ni aparecer en el directorio.
- Al pasar a `ACTIVE` arranca la **prueba de 30 días** (no al registrarse: así la prueba no se consume mientras esperan la revisión).
- `REJECTED` es final para esa solicitud. Pueden crear una nueva solicitud con documentos nuevos (máximo 3 intentos; después, solo soporte).

#### 5.2 Endpoints de clínica

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| POST | `/veterinaries` | base | `RegisterVeterinary` (🔧) |
| GET | `/veterinaries/{id}` | miembro | `GetVeterinary` 🆕 |
| PATCH | `/veterinaries/{id}` | `CLINIC_CONFIGURE` | `UpdateVeterinary` ✅ |
| PATCH | `/veterinaries/{id}/settings` | `CLINIC_CONFIGURE` | `UpdateVeterinarySettings` 🆕 |
| PUT | `/veterinaries/{id}/logo` | `CLINIC_CONFIGURE` | `UploadVeterinaryLogo` 🆕 (bucket público `veterinary-logos`, ≤2 MB, png/jpeg/webp) |
| DELETE | `/veterinaries/{id}/logo` | `CLINIC_CONFIGURE` | `DeleteVeterinaryLogo` 🆕 |
| POST | `/veterinaries/{id}/invite-code` | `CLINIC_CONFIGURE` | `GenerateInviteCode` ✅ |
| DELETE | `/veterinaries/{id}/invite-code` | `CLINIC_CONFIGURE` | `RevokeInviteCode` 🆕 |
| GET | `/me/veterinaries` | base | `GetMyVeterinaries` 🆕 (clínicas donde soy empleado activo, con rol y estado — la web lo usa para elegir clínica) |
| GET | `/public/veterinaries` | público | `SearchVeterinaryDirectory` 🆕 (`q`, `city`, `lat`, `lng`, `radiusKm`, paginado; solo `ACTIVE` y `directory_visible`) |
| GET | `/public/veterinaries/{id}` | público | `GetPublicVeterinaryProfile` 🆕 (sin NIT ni datos internos) |
| GET | `/public/veterinaries/by-code/{code}` | público | `PreviewVeterinaryByCode` 🆕 (vista previa antes de vincularse) |
| PATCH | `/admin/veterinaries/{id}/suspend` | `PLATFORM_ADMIN` | `SuspendVeterinary` (antes `DeActivate`) |
| PATCH | `/admin/veterinaries/{id}/reactivate` | `PLATFORM_ADMIN` | `ReactivateVeterinary` (antes `Activate`) |

Reglas de `RegisterVeterinary`:
- El creador sale de `sub` del token. Requiere `email_verified = true`.
- Valida nombre, email, NIT (formato `\d{9}-\d` con dígito de verificación — implementar el algoritmo de la DIAN en un value object `Nit`), teléfono.
- Únicos: nombre, email, NIT.
- En la **misma transacción**: crea la clínica (`PENDING_DOCUMENTS`), crea al creador como empleado `OWNER` y crea una `verification_request` en `DRAFT`.
- Un usuario puede ser `OWNER` de máximo 3 clínicas en estado no final (anti-spam).
- Publica `VETERINARY_REGISTERED`.

#### 5.3 Endpoints de verificación

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| GET | `/veterinaries/{id}/verification` | miembro | `GetClinicVerification` |
| POST | `/veterinaries/{id}/verification/documents` | `OWNER` | `UploadVerificationDocument` (multipart: `documentType`, `file`; pdf/jpeg/png, ≤10 MB) |
| DELETE | `/veterinaries/{id}/verification/documents/{docId}` | `OWNER` | `DeleteVerificationDocument` (solo en `DRAFT`/`NEEDS_CORRECTION`) |
| POST | `/veterinaries/{id}/verification/submit` | `OWNER` | `SubmitClinicVerification` |
| GET | `/admin/verifications?status=&subjectType=` | `PLATFORM_ADMIN` | `ListVerificationRequests` |
| GET | `/admin/verifications/{requestId}` | `PLATFORM_ADMIN` | `GetVerificationRequestDetail` (incluye URLs **firmadas** de 10 min y el `ai_report`) |
| POST | `/admin/verifications/{requestId}/rerun-ai` | `PLATFORM_ADMIN` | `RerunVerificationAnalysis` |
| POST | `/admin/verifications/{requestId}/approve` | `PLATFORM_ADMIN` | `ApproveVerification` (body: `registryChecked: true` obligatorio) |
| POST | `/admin/verifications/{requestId}/reject` | `PLATFORM_ADMIN` | `RejectVerification` (body: `reason` obligatorio) |
| POST | `/admin/verifications/{requestId}/request-correction` | `PLATFORM_ADMIN` | `RequestVerificationCorrection` (body: `notes`, `documentTypes[]`) |

Reglas:
- `Submit` exige todos los documentos obligatorios del tipo de sujeto. Si el `OWNER` declaró ser veterinario, su perfil profesional se envía en el mismo paso (§5.4).
- Al enviar: estado `UNDER_REVIEW`, `ai_status = RUNNING`, se dispara el análisis **asíncrono** (`@Async` + `ApplicationEventPublisher` interno) que llama a `IaVerificationPort` (requiere IA-01). La respuesta HTTP no espera a la IA.
- Si la IA falla o tarda más de 60 s → `ai_status = FAILED`. **La revisión humana sigue igual**; la IA nunca bloquea ni decide.
- `Approve` solo es válido si `registryChecked = true` (el admin confirmó en el portal oficial). Se guarda quién aprobó y cuándo.
- `sha256` repetido entre clínicas distintas → se marca en el detalle como alerta para el admin.
- Los documentos van en bucket **privado** `verification-documents` en la ruta `verifications/{requestId}/{documentId}.<ext>`. Nunca se devuelven URLs públicas.
- Retención: documentos de solicitudes `REJECTED` se borran a los 90 días (job).

#### 5.4 Perfil profesional

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| GET | `/me/professional-profile` | base | `GetMyProfessionalProfile` |
| PUT | `/me/professional-profile` | base | `UpsertProfessionalProfile` (no editable si está `PENDING`; si está `VERIFIED` y cambia `license_number`, vuelve a `NOT_SUBMITTED`) |
| POST | `/me/professional-profile/documents` | base | `UploadProfessionalDocument` |
| PUT | `/me/professional-profile/signature` | base | `UploadSignature` (png, bucket privado) |
| POST | `/me/professional-profile/submit` | base | `SubmitProfessionalVerification` (crea `verification_request` con `subject_type = PROFESSIONAL`) |
| GET | `/veterinaries/{id}/employees/{employeeId}/professional-profile` | miembro | `GetEmployeeProfessionalProfile` (sin documentos) |

La aprobación usa los mismos endpoints `/admin/verifications/**`. Al aprobar: `license_status = VERIFIED` → el siguiente refresh del token trae `vet_licensed = true`.

#### 5.5 Endpoints internos de clínica

| Método | Ruta | Usado por |
|---|---|---|
| GET | `/internal/veterinaries/{id}/members/{userId}` | User service (emitir token de clínica) |
| GET | `/internal/veterinaries/{id}/summary` | Notifications, Calendar (nombre, logo, teléfono, dirección, timezone) |

Respuesta de `members`:

```json
{ "member": true, "employeeId": "uuid", "role": "VETERINARIAN", "active": true,
  "licensed": true, "veterinaryStatus": "ACTIVE", "subscriptionStatus": "TRIAL" }
```

---

### 6. Módulo personal

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| GET | `/veterinaries/{id}/employees` | miembro | `ListEmployees` 🆕 (enriquecido con nombre/email desde `UserServicePort` batch) |
| GET | `/veterinaries/{id}/employees/{employeeId}` | miembro | `GetEmployee` 🆕 |
| POST | `/veterinaries/{id}/employee-invitations` | `STAFF_MANAGE` | `InviteEmployee` 🆕 (`email`, `role`) |
| GET | `/veterinaries/{id}/employee-invitations?status=` | `STAFF_MANAGE` | `ListEmployeeInvitations` 🆕 |
| POST | `/veterinaries/{id}/employee-invitations/{invId}/resend` | `STAFF_MANAGE` | `ResendEmployeeInvitation` 🆕 |
| DELETE | `/veterinaries/{id}/employee-invitations/{invId}` | `STAFF_MANAGE` | `CancelEmployeeInvitation` 🆕 |
| GET | `/me/employee-invitations` | base | `GetMyPendingEmployeeInvitations` 🆕 (por `email` del token) |
| POST | `/employee-invitations/{token}/accept` | base | `AcceptEmployeeInvitation` 🆕 |
| POST | `/employee-invitations/{token}/reject` | base | `RejectEmployeeInvitation` 🆕 |
| PATCH | `/veterinaries/{id}/employees/{employeeId}/role` | `STAFF_MANAGE` | `UpdateEmployeeRole` 🔧 |
| PATCH | `/veterinaries/{id}/employees/{employeeId}/activate` | `STAFF_MANAGE` | `ActivateEmployee` 🔧 |
| PATCH | `/veterinaries/{id}/employees/{employeeId}/deactivate` | `STAFF_MANAGE` | `DeactivateEmployee` 🔧 |
| POST | `/veterinaries/{id}/ownership-transfer` | `OWNER` | `TransferOwnership` 🆕 |
| DELETE | `/veterinaries/{id}/employees/me` | miembro | `LeaveVeterinary` 🆕 |

Reglas:
- Invitar: no se puede invitar con rol `OWNER`. No se puede invitar a alguien que ya es empleado activo. Una sola invitación `PENDING` por clínica+email (`EmployeeInvitationAlreadyExistsException`). Expira en 7 días. Valida límite `max_employees` del plan (cuenta empleados activos + invitaciones pendientes).
- Aceptar: invitación `PENDING` y no vencida; `email` del token **igual** (case-insensitive) al de la invitación; `email_verified = true`. Si el usuario fue empleado antes y está inactivo, se reactiva con el rol nuevo en lugar de crear otra fila. Reutiliza el servicio de `CreateVeterinaryEmployee`.
- `ADMIN` no puede cambiar rol, desactivar ni modificar a un `OWNER` ni a otro `ADMIN`. Nadie puede modificarse a sí mismo el rol.
- `TransferOwnership`: el destino debe ser empleado activo; en una transacción el `OWNER` actual pasa a `ADMIN` y el destino pasa a `OWNER`.
- `LeaveVeterinary`: el `OWNER` no puede irse sin transferir antes.
- Eventos: `EMPLOYEE_INVITED`, `EMPLOYEE_JOINED`, `EMPLOYEE_ROLE_UPDATED`, `EMPLOYEE_DEACTIVATED`, `OWNERSHIP_TRANSFERRED`.

---

### 7. Módulo vinculación y pacientes

#### 7.1 Vinculación del dueño (cliente)

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| POST | `/veterinaries/link` | base | `LinkToVeterinary` 🔁 (body: `code`; reemplaza `LinkByCode`/`LinkByUrl`) |
| GET | `/me/linked-veterinaries` | base | `GetMyLinkedVeterinaries` 🆕 |
| DELETE | `/veterinaries/{id}/link` | base | `Unlink` 🔧 (lado dueño) |
| GET | `/veterinaries/{id}/clients` | `CLINICAL_READ_BASIC` | `ListClients` 🆕 |
| DELETE | `/veterinaries/{id}/clients/{userId}` | `CLINIC_CONFIGURE` | `RemoveClient` 🆕 (lado clínica) |

Reglas: la clínica debe estar `ACTIVE`. Al desvincular (cualquier lado) se revocan **todas** las mascotas de ese dueño en esa clínica (`consent_status = REVOKED`). Eventos: `USER_LINKED`, `USER_UNLINKED`.

> **Fase posterior (idea, 7 oct 2026, sin contrato todavía):** solicitud de vinculación iniciada por la clínica. La clínica busca al dueño por correo o teléfono y le envía una solicitud; el dueño la ve en la app, la acepta y elige qué mascotas compartir (mismo `SharePetsWithVeterinary`). Necesita definir aquí endpoints, estados de la solicitud (pendiente, aceptada, rechazada, vencida), privacidad de la búsqueda (no revelar si un correo tiene cuenta) y el evento de notificación. No entra en el plan del 3 de noviembre: mientras tanto, el código/QR en recepción cubre ese caso.

#### 7.2 Consentimiento por mascota

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| POST | `/veterinaries/{id}/patients/share` | base | `SharePetsWithVeterinary` 🆕 (body: `petIds[]`) |
| DELETE | `/veterinaries/{id}/patients/{petId}/share` | base | `RevokePetShare` 🆕 |
| GET | `/me/pets/{petId}/veterinaries` | base | `GetVeterinariesForPet` 🆕 (qué clínicas ven mi mascota) |

Reglas de `Share`:
- El usuario debe estar vinculado a la clínica.
- Por cada `petId`, verificar con `PetsServicePort.isOwner(petId, userId)` (endpoint existente `GET /pets/{petId}/owner/{userId}`, migrado a interno — requiere PETS-04). Si alguno no es suyo → `403` y no se comparte ninguno (todo o nada).
- Si ya existía `REVOKED`, se reactiva (`GRANTED`, nuevo `granted_at`).
- Guarda el snapshot (`pet_name`, `species`, `owner_name`, `owner_phone`, `owner_email`) leyendo Pets y User.
- Valida límite `max_patients` del plan.
- Eventos: `PET_SHARED_WITH_VETERINARY` (destinatario: el `OWNER` de la clínica, o no se notifica — decisión de producto), `PET_SHARE_REVOKED`.

#### 7.3 Pacientes desde la clínica

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| GET | `/veterinaries/{id}/patients?q=&species=&page=&size=` | `CLINICAL_READ_BASIC` | `ListVeterinaryPatients` 🆕 (búsqueda full-text en snapshot + teléfono exacto) |
| GET | `/veterinaries/{id}/patients/{petId}` | `CLINICAL_READ_BASIC` | `GetVeterinaryPatient` 🆕 (datos de Pets en vivo vía batch) |
| POST | `/veterinaries/{id}/patients/walk-in` | `PATIENT_REGISTER` | `RegisterWalkInPatient` 🆕 |
| POST | `/veterinaries/{id}/patients/{petId}/claim-invitation` | `PATIENT_REGISTER` | `SendPetClaimInvitation` 🆕 |

`RegisterWalkInPatient` (dueño sin app):

```json
{
  "pet":   { "name": "Max", "species": "DOG", "breed": "Criollo", "sex": "MALE", "birthDate": "2021-05-10" },
  "owner": { "fullName": "Carlos Pérez", "phone": "+573001234567", "email": "carlos@correo.com",
             "documentType": "CC", "documentNumber": "1047…" },
  "sendClaimInvitation": true
}
```

1. Llama `PetsServicePort.createClinicPet(...)` → Pets crea la mascota con `owner_id = null` y `created_by_veterinary_id` (requiere PETS-05).
2. Crea `veterinary_patients` con `origin = REGISTERED_BY_CLINIC`, `consent_status = GRANTED`, `granted_by = null`.
3. Si `sendClaimInvitation` y hay email → `PetsServicePort.createClaimInvitation(petId, email, veterinaryId)` (requiere PETS-06). Pets publica el evento y Notifications envía el email.
4. Si el paso 1 funcionó pero el 2 falla → llamar `PetsServicePort.deleteClinicPet(petId)` (compensación). Loguear si la compensación falla.

Cuando el dueño reclama la mascota en la app, el consentimiento con la clínica que la registró **se mantiene** (el texto de aceptación del reclamo lo dice explícitamente). No hace falta callback: Veterinary no guarda `owner_id`, lo pide a Pets cuando lo necesita.

#### 7.4 Endpoint interno de acceso

`GET /internal/veterinaries/{id}/patients/{petId}/access?userId=` — contrato exacto en `CONTRATOS_COMPARTIDOS.md §3`.
Implementación: un solo query que une `veterinary_employees` (activo) + `veterinaries` (estado) + `veterinary_patients` (`GRANTED`) + `professional_profiles` (licencia) y aplica `RolePermissions.resolve`.
Es el endpoint más llamado del sistema: índice compuesto y test de rendimiento básico (< 50 ms en local).

---

### 8. Módulo catálogo y horarios

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| GET | `/veterinaries/{id}/services` | miembro | `ListClinicServices` |
| GET | `/public/veterinaries/{id}/services` | público | `ListPublicClinicServices` (solo activos y `bookable_online`) |
| POST | `/veterinaries/{id}/services` | `CLINIC_CONFIGURE` | `CreateClinicService` |
| PATCH | `/veterinaries/{id}/services/{serviceId}` | `CLINIC_CONFIGURE` | `UpdateClinicService` |
| PATCH | `/veterinaries/{id}/services/{serviceId}/deactivate` | `CLINIC_CONFIGURE` | `DeactivateClinicService` (no se borra: hay citas que lo referencian) |
| GET / PUT | `/veterinaries/{id}/business-hours` | miembro / `CLINIC_CONFIGURE` | `GetBusinessHours` / `ReplaceBusinessHours` (reemplaza la semana completa; valida que no se solapen franjas del mismo día) |
| GET / PUT | `/veterinaries/{id}/employees/{employeeId}/schedule` | miembro / `CLINIC_CONFIGURE` | `GetEmployeeSchedule` / `ReplaceEmployeeSchedule` (debe caer dentro del horario de la clínica) |
| GET | `/veterinaries/{id}/schedule-blocks?from=&to=` | miembro | `ListScheduleBlocks` |
| POST | `/veterinaries/{id}/schedule-blocks` | `CLINIC_CONFIGURE` (o el propio empleado para sí mismo) | `CreateScheduleBlock` |
| DELETE | `/veterinaries/{id}/schedule-blocks/{blockId}` | idem | `DeleteScheduleBlock` |
| GET | `/internal/veterinaries/{id}/schedule-rules?from=&to=&employeeId=` | interno | `GetScheduleRules` (lo consume Calendar para calcular disponibilidad) |

Respuesta de `schedule-rules`:

```json
{
  "timezone": "America/Bogota",
  "defaultAppointmentMinutes": 30,
  "allowOnlineBooking": true,
  "bookingRequiresConfirmation": true,
  "cancellationMinHours": 4,
  "businessHours": [{ "dayOfWeek": 1, "opensAt": "08:00", "closesAt": "18:00" }],
  "employees": [{ "employeeId": "uuid", "role": "VETERINARIAN",
                  "schedule": [{ "dayOfWeek": 1, "startsAt": "08:00", "endsAt": "14:00" }] }],
  "blocks": [{ "employeeId": null, "startsAt": "2026-12-25T00:00:00-05:00", "endsAt": "2026-12-26T00:00:00-05:00" }],
  "services": [{ "id": "uuid", "name": "Consulta general", "durationMinutes": 30, "price": 60000 }]
}
```

---

### 9. Módulo suscripción

#### 9.1 Planes iniciales (seed en V9)

| Código | Precio mensual | Empleados | Pacientes | Features |
|---|---|---|---|---|
| `FREE` | 0 | 1 | 100 | — |
| `BASIC` | definir | 5 | 1.000 | `ONLINE_BOOKING` |
| `PRO` | definir | ilimitado | ilimitado | `ONLINE_BOOKING`, `WHATSAPP`, `REPORTS`, `AI_SUMMARY` |

La prueba de 30 días se da con el plan `PRO` (`status = TRIAL`). Al terminar sin pago → baja a `FREE` (no se bloquea la clínica, solo se aplican límites; los pacientes por encima del límite quedan en solo lectura).

#### 9.2 Endpoints

| Método | Ruta | Token / permiso | Caso de uso |
|---|---|---|---|
| GET | `/public/plans` | público | `ListPlans` |
| GET | `/veterinaries/{id}/subscription` | miembro | `GetActivePlan` ✅ |
| GET | `/veterinaries/{id}/subscription/expired` | miembro | `IsExpired` ✅ |
| GET | `/veterinaries/{id}/subscription/usage` | miembro | `GetPlanUsage` 🆕 (empleados y pacientes usados vs límite) |
| POST | `/veterinaries/{id}/subscription/checkout` | `SUBSCRIPTION_MANAGE` | `CreateCheckout` 🆕 (body: `planCode`, `billingPeriod`; devuelve link de pago) |
| POST | `/webhooks/payments/wompi` | público + firma | `HandlePaymentWebhook` 🆕 |
| POST | `/veterinaries/{id}/subscription/cancel` | `SUBSCRIPTION_MANAGE` | `CancelSubscription` 🆕 (`cancel_at_period_end = true`) |
| GET | `/veterinaries/{id}/subscription/history` | `SUBSCRIPTION_MANAGE` | `GetSubscriptionHistory` 🆕 |
| POST | `/admin/veterinaries/{id}/subscription` | `PLATFORM_ADMIN` | `CreatePlan` 🔧 (asignación manual, pilotos) |
| PATCH | `/admin/veterinaries/{id}/subscription` | `PLATFORM_ADMIN` | `UpdatePlan` 🔧 |
| POST | `/internal/jobs/subscriptions/daily` | interno (Cloud Scheduler) | `RunSubscriptionLifecycle` 🆕 |

#### 9.3 Pasarela

- Usar **Wompi en modo sandbox** para el proyecto (llaves de prueba, sin dinero real). Puerto `PaymentGatewayPort` para poder cambiar de proveedor.
- El webhook valida la firma del evento con el secreto de eventos, es **idempotente** (`provider_reference` único) y solo activa el plan con estado `APPROVED`.
- Nunca activar un plan por la redirección del navegador: solo por webhook.

#### 9.4 Job diario `RunSubscriptionLifecycle`

1. Suscripciones que vencen en 7 días → `SUBSCRIPTION_EXPIRING`.
2. Vencidas hoy → `GRACE` (5 días, todo funciona) + `SUBSCRIPTION_IN_GRACE`.
3. Gracia terminada → `EXPIRED` y la clínica pasa a plan `FREE` + `SUBSCRIPTION_EXPIRED`.
4. `cancel_at_period_end` y periodo terminado → `CANCELLED` + plan `FREE`.
5. Borrar documentos de verificaciones rechazadas con más de 90 días.

El job debe ser idempotente (correrlo dos veces el mismo día no duplica eventos).

#### 9.5 Guardas de plan

`PlanLimitGuard` (servicio de aplicación) con `requireCapacity(veterinaryId, Resource.EMPLOYEES | PATIENTS)` y `requireFeature(veterinaryId, Feature)`. Se llama desde `InviteEmployee`, `AcceptEmployeeInvitation`, `SharePetsWithVeterinary`, `RegisterWalkInPatient` y desde el endpoint interno que consulta Calendar para reservas online.

---

### 10. Agenda — integración con Calendar

**Opción A (recomendada si ya existe un microservicio de calendario/citas):** Veterinary **no** guarda citas. Expone `schedule-rules` (§8) y `access` (§7.4). Calendar guarda las citas con `veterinaryId`, `employeeId`, `petId`, `serviceId`. Ver `CALENDAR_SERVICE_CHANGES.md`.

**Opción B (si no existe):** crear aquí el módulo `appointments` con la tabla y estados descritos en `CALENDAR_SERVICE_CHANGES.md §3`, publicando al topic `veterinary-appointments`. Los endpoints son los mismos de ese archivo, montados bajo `/veterinaries/{id}/appointments`.

Decidir A o B **antes** de VET-30.

---

### 11. Eventos que publica Veterinary

Sobre según `CONTRATOS_COMPARTIDOS.md §4`. Adaptador `GooglePubSubEventAdapter` con mapa `eventType → topic`. **Test obligatorio** que recorra el enum de eventos y verifique que todos tienen topic (en Pets un evento sin topic se pierde en silencio; aquí debe fallar el test).

| Evento | Topic | Destinatario (`userId` / `recipient`) | Payload mínimo |
|---|---|---|---|
| `VETERINARY_REGISTERED` | veterinary-clinic | creador | veterinaryId, name |
| `VERIFICATION_SUBMITTED` | veterinary-verification | `null` + recipient = email de soporte | requestId, subjectType, veterinaryName |
| `VERIFICATION_APPROVED` | veterinary-verification | quien envió | subjectType, veterinaryName, trialEndsAt |
| `VERIFICATION_REJECTED` | veterinary-verification | quien envió | subjectType, reason |
| `VERIFICATION_CORRECTION_REQUESTED` | veterinary-verification | quien envió | notes, documentTypes |
| `VETERINARY_SUSPENDED` / `_REACTIVATED` | veterinary-clinic | OWNER | veterinaryName |
| `EMPLOYEE_INVITED` | veterinary-staff | `null` + recipient = email invitado | veterinaryName, role, acceptUrl, expiresAt |
| `EMPLOYEE_JOINED` | veterinary-staff | OWNER | employeeName, role |
| `EMPLOYEE_ROLE_UPDATED` | veterinary-staff | empleado | oldRole, newRole |
| `EMPLOYEE_DEACTIVATED` | veterinary-staff | empleado | veterinaryName |
| `OWNERSHIP_TRANSFERRED` | veterinary-staff | nuevo OWNER | veterinaryName |
| `USER_LINKED` / `USER_UNLINKED` | veterinary-patients | dueño | veterinaryName |
| `PET_SHARED_WITH_VETERINARY` | veterinary-patients | dueño (confirmación) | petName, veterinaryName |
| `PET_SHARE_REVOKED` | veterinary-patients | dueño | petName, veterinaryName |
| `SUBSCRIPTION_TRIAL_STARTED` | veterinary-subscription | OWNER | planName, trialEndsAt |
| `SUBSCRIPTION_EXPIRING` / `_IN_GRACE` / `_EXPIRED` | veterinary-subscription | OWNER | planName, date |
| `SUBSCRIPTION_RENEWED` / `PAYMENT_FAILED` | veterinary-subscription | OWNER | planName, amount |

---

### 12. Clientes HTTP hacia otros servicios

Puertos en `application/shared/ports/out`, adaptadores con `RestClient` en `infrastructure/clients`, todos con `X-Internal-Api-Key`, timeout 3 s y manejo de error → excepción de dominio `ExternalServiceUnavailableException` (503).

| Puerto | Métodos | Endpoint destino |
|---|---|---|
| `UserServicePort` | `getUser(id)`, `getUsers(ids)`, `findByEmail(email)` | `USER-06` |
| `PetsServicePort` | `isOwner(petId, userId)`, `getPets(ids)`, `createClinicPet(...)`, `deleteClinicPet(id)`, `createClaimInvitation(...)` | `PETS-04`, `PETS-05`, `PETS-06` |
| `IaVerificationPort` | `analyze(request)` | `IA-01` |
| `CalendarServicePort` | (solo opción A, si Veterinary necesita contar citas para reportes) | `CAL-xx` |
| `FileStoragePort` | `uploadPublic`, `uploadPrivate`, `signedUrl(path, ttl)`, `delete` | Supabase Storage |

Variables de entorno nuevas:

```
JWT_JWKS_URI, INTERNAL_API_KEY,
USER_SERVICE_URL, PETS_SERVICE_URL, IA_SERVICE_URL, CALENDAR_SERVICE_URL,
GCP_PROJECT_ID, SUPABASE_URL, SUPABASE_KEY (service role, solo backend),
WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET, WOMPI_BASE_URL,
APP_BASE_URL, SUPPORT_EMAIL
```

---

### 13. Tareas en orden

> ☐ = pendiente. Cada tarea incluye sus tests. No se pasa a la siguiente fase con tests rojos.

#### Fase 0 — Bases

- ☐ **VET-01** Agregar Flyway (`baseline-on-migrate`), migrar el esquema actual como baseline. *Listo cuando:* `./mvnw spring-boot:run` aplica V1 sin tocar datos.
- ☐ **VET-02** Reorganizar paquetes por módulo (§2) sin cambiar comportamiento. *Listo cuando:* todos los tests existentes pasan.
- ☐ **VET-03** Pasar tests a **Testcontainers** (Postgres 16) con perfil `test`. *Listo cuando:* `./mvnw test` corre sin `.env` ni Supabase.
- ☐ **VET-04** `GooglePubSubEventAdapter` + `EventPublisherPort` + sobre de evento + test de cobertura de topics.

#### Fase 1 — Seguridad *(requiere USER-01, USER-02)*

- ☐ **VET-05** Resource server JWKS, `SecurityConfig`, `JwtClaimsConverter`, `InternalApiKeyFilter` (§4.1–4.3).
- ☐ **VET-06** `AuthenticatedUserPort` + adaptador, `Permission`, `RolePermissions` + `RolePermissionsTest` (§4.4–4.5).
- ☐ **VET-07** `VeterinaryAuthorizationService` + excepciones + handlers (§4.6–4.7).
- ☐ **VET-08** Quitar `userId` de todos los bodies/params existentes y aplicar permisos a los 16 casos de uso actuales según §1. Tests de controller con `jwt()` incluyendo 401, 403 por rol y 403 por otra clínica.

#### Fase 2 — Clínica, roles y verificación

- ☐ **VET-09** Migraciones V2 y V3. `VeterinaryStatus` reemplaza el booleano `active` en dominio, entidad y mapper.
- ☐ **VET-10** `RegisterVeterinary` 🔧 (OWNER + verificación DRAFT en una transacción, value object `Nit`).
- ☐ **VET-11** Endpoint interno `members` (§5.5). *Desbloquea USER-03.*
- ☐ **VET-12** `GetVeterinary`, `UpdateVeterinarySettings`, logo, `RevokeInviteCode`, `GetMyVeterinaries`.
- ☐ **VET-13** Mover `Activate`/`DeActivate` a admin (`Suspend`/`Reactivate`).
- ☐ **VET-14** Migraciones V4 y V5. `FileStoragePort` con bucket privado y URLs firmadas.
- ☐ **VET-15** Verificación de clínica: subir/borrar documentos, `Submit`, estados (§5.3).
- ☐ **VET-16** Perfil profesional completo (§5.4).
- ☐ **VET-17** Panel admin de verificación: listar, detalle con URLs firmadas, aprobar/rechazar/pedir corrección. Aprobar clínica inicia la prueba (depende de VET-36 para el plan; mientras tanto, crear la suscripción `TRIAL` directo).
- ☐ **VET-18** Análisis asíncrono con `IaVerificationPort` + `rerun-ai` *(requiere IA-01)*. Si IA no está lista, dejar el adaptador devolviendo `FAILED` y seguir.
- ☐ **VET-19** Eventos de verificación y clínica.

#### Fase 3 — Personal

- ☐ **VET-20** Migración V6. `UserServicePort` *(requiere USER-06)*.
- ☐ **VET-21** Invitaciones de empleado: invitar, listar, reenviar, cancelar, mis invitaciones, aceptar, rechazar.
- ☐ **VET-22** `ListEmployees`, `GetEmployee` (enriquecidos), reglas nuevas de `UpdateEmployeeRole`/`Activate`/`Deactivate`.
- ☐ **VET-23** `TransferOwnership`, `LeaveVeterinary`. Deprecar el endpoint público `CreateVeterinaryEmployee`.
- ☐ **VET-24** Eventos de personal.

#### Fase 4 — Pacientes *(requiere PETS-04, PETS-05, PETS-06)*

- ☐ **VET-25** Migración V7. `PetsServicePort`.
- ☐ **VET-26** `LinkToVeterinary` (unifica), `Unlink` desde ambos lados con revocación en cascada, `ListClients`, `GetMyLinkedVeterinaries`, preview por código.
- ☐ **VET-27** `SharePetsWithVeterinary`, `RevokePetShare`, `GetVeterinariesForPet`.
- ☐ **VET-28** `ListVeterinaryPatients` (búsqueda), `GetVeterinaryPatient`, `RegisterWalkInPatient` con compensación, `SendPetClaimInvitation`.
- ☐ **VET-29** Endpoint interno `access` (§7.4) con test de cada caso de `hasAccess=false`. *Desbloquea PETS-03, MED-03, CAL-02.*

#### Fase 5 — Catálogo, horarios y agenda

- ☐ **VET-30** Decidir opción A o B de §10.
- ☐ **VET-31** Migración V8. Servicios de la clínica (CRUD + público).
- ☐ **VET-32** Horario de clínica, horario por empleado, bloqueos.
- ☐ **VET-33** Endpoint interno `schedule-rules`. *Desbloquea CAL-03.*
- ☐ **VET-34** Directorio público con búsqueda por ciudad y distancia (fórmula de Haversine en SQL; PostGIS no es necesario para el volumen del proyecto).
- ☐ **VET-35** (Solo opción B) módulo `appointments`.

#### Fase 6 — Suscripción

- ☐ **VET-36** Migración V9 + seed de planes. `ListPlans`, `GetPlanUsage`. Adaptar `GetActivePlan`/`IsExpired` al nuevo modelo.
- ☐ **VET-37** `PlanLimitGuard` aplicado en invitaciones, aceptación, share y walk-in.
- ☐ **VET-38** `PaymentGatewayPort` + adaptador Wompi sandbox, `CreateCheckout`, webhook idempotente con firma.
- ☐ **VET-39** `CancelSubscription`, historial, mover `CreatePlan`/`UpdatePlan` a admin.
- ☐ **VET-40** Job diario idempotente + endpoint `/internal/jobs/subscriptions/daily` + configuración de Cloud Scheduler.
- ☐ **VET-41** Eventos de suscripción.

#### Fase 7 — Cierre

- ☐ **VET-42** OpenAPI: agrupar por módulo, documentar `bearerAuth`, ejemplos de request/response.
- ☐ **VET-43** Actualizar `CLAUDE.md` del repo con la nueva arquitectura, seguridad y módulos.
- ☐ **VET-44** Colección de Postman/Bruno reorganizada por módulo con variables `{{baseToken}}`, `{{vetToken}}`, `{{adminToken}}`.
- ☐ **VET-45** Dockerfile + despliegue en Cloud Run (service account con `roles/pubsub.publisher`).

---

### 14. Orden global entre repos

```
USER-01, USER-02 (JWT RS256 + JWKS)
   └─▶ VET Fase 0 y 1
         └─▶ VET-11 ─▶ USER-03, USER-04 (token de clínica)
               └─▶ VET Fase 2  ◀── IA-01 (puede ir en paralelo)
                     └─▶ USER-06 ─▶ VET Fase 3
                           └─▶ PETS-01…06 ─▶ VET Fase 4 ─▶ VET-29
                                 ├─▶ MED-01…06
                                 └─▶ VET Fase 5 ─▶ CAL-01…06
NOTIF-01…06 en paralelo desde que existan los primeros eventos
VET Fase 6 al final
```

---

### 15. Criterio de "base técnica completa"

La base técnica de MyAnimaLogVet está completa cuando este recorrido funciona de punta a punta en un ambiente de pruebas:

1. Ana se registra en la app, crea "Clínica Patitas", sube RUT, Cámara de Comercio, cédula y su tarjeta profesional, y envía.
2. La IA deja un reporte; un admin revisa, verifica en el portal oficial y aprueba. Ana recibe el correo y su prueba de 30 días inicia.
3. Ana invita a Luis (veterinario) y a Sofía (recepcionista). Ambos aceptan desde su correo. Luis sube su tarjeta y es aprobado.
4. Sofía registra a "Max", cuyo dueño no tiene la app, y le envía invitación para reclamarlo.
5. Carlos (dueño) instala la app, reclama a Max y ve que Clínica Patitas tiene acceso.
6. Otra dueña se vincula con el código QR, comparte a su gata y pide una cita desde la app. Sofía la confirma.
7. Luis atiende: marca la cita como atendida, registra la visita y aplica una vacuna en Medical. Sofía intenta escribir un diagnóstico y recibe 403.
8. Un empleado de otra clínica intenta leer a Max y recibe 403.
9. La dueña revoca el acceso de la clínica a su gata; Luis ya no puede leer su historia.
10. Se simula el fin de la prueba: llega aviso, periodo de gracia y baja a `FREE`. Ana paga con Wompi sandbox y vuelve a `PRO`.

---

## 8. Cambios en user-service para MyAnimaLogVet


> Leer junto con `CONTRATOS_COMPARTIDOS.md`. Este servicio es el **único emisor de tokens**.
> No se tuvo acceso al `CLAUDE.md` de este repo: los ejemplos asumen Spring Boot 3 / Java 17 como Pets y Veterinary. Si el stack es otro, mantener el contrato y adaptar la implementación.
> Es el primer repo que se toca: **todo lo demás depende de USER-01 y USER-02.**

---

### USER-01 — Firma RS256 y JWKS

1. Generar un par de llaves RSA 2048 por ambiente. Guardar la privada como secreto (`JWT_PRIVATE_KEY_PEM`, en Secret Manager en Cloud Run; en local, archivo fuera del repo). La pública se deriva.
2. Asignar un `kid` (ej. `2026-10-key-1`).
3. Exponer `GET /.well-known/jwks.json` público, con `Cache-Control: public, max-age=600`:
   ```json
   { "keys": [ { "kty": "RSA", "kid": "2026-10-key-1", "use": "sig", "alg": "RS256", "n": "…", "e": "AQAB" } ] }
   ```
   Con Spring: `com.nimbusds:nimbus-jose-jwt` → `new JWKSet(rsaKey.toPublicJWK()).toJSONObject()`.
4. Firmar todos los tokens con RS256 y header `kid`.
5. Rotación: el JWKS puede publicar dos llaves a la vez (la vieja hasta que venzan sus tokens).

*Listo cuando:* un token emitido se valida en jwt.io pegando la llave pública, y el endpoint JWKS responde sin autenticación.

### USER-02 — Claims del token base y refresh

1. Agregar columna `platform_role VARCHAR(20) NOT NULL DEFAULT 'USER'` en la tabla de usuarios. Script para marcar a los admins del equipo como `PLATFORM_ADMIN` (no hay endpoint para auto-asignarse ese rol).
2. Token base con exactamente los claims de `CONTRATOS_COMPARTIDOS.md §1.2`, vida 15 min, `iss`, `aud`, `jti`.
3. Asegurar que existe verificación de email y que el claim `email_verified` refleja el estado real.
4. Refresh tokens:
   ```sql
   CREATE TABLE refresh_tokens (
     id UUID PRIMARY KEY,
     user_id UUID NOT NULL,
     token_hash VARCHAR(64) NOT NULL UNIQUE,     -- SHA-256 del token opaco
     context VARCHAR(20) NOT NULL,              -- USER, VETERINARY
     veterinary_id UUID,                        -- solo si context = VETERINARY
     expires_at TIMESTAMPTZ NOT NULL,
     revoked_at TIMESTAMPTZ,
     replaced_by UUID,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```
5. `POST /auth/refresh` con rotación: el refresh usado se revoca y se emite uno nuevo. Si llega un refresh ya revocado (reutilización) → revocar toda la cadena de ese usuario (posible robo).
6. `POST /auth/logout` revoca el refresh actual.

*Listo cuando:* login devuelve `{ accessToken, refreshToken, expiresIn: 900 }` y refresh rota correctamente.

### USER-03 — Token de contexto de clínica *(requiere VET-11)*

`POST /auth/context/veterinary/{veterinaryId}` — requiere token base válido.

1. Llamar `GET {VETERINARY_SERVICE_URL}/internal/veterinaries/{veterinaryId}/members/{sub}` con `X-Internal-Api-Key`.
2. Si `member = false` o `active = false` → `403`.
3. Si `veterinaryStatus` es `REJECTED` → `403`. Cualquier otro estado sí recibe token (`PENDING_DOCUMENTS`, `UNDER_REVIEW`, `NEEDS_CORRECTION` y `SUSPENDED` lo necesitan para ver su estado y corregir; los permisos los limita Veterinary).
4. Emitir access token con los claims de `CONTRATOS_COMPARTIDOS.md §1.3` y un refresh con `context = VETERINARY`, `veterinary_id`.
5. Si Veterinary no responde → `503` (nunca emitir token sin confirmar).

Respuesta: `{ accessToken, refreshToken, expiresIn, veterinary: { id, role, status } }`.

### USER-04 — Refresh de contexto de clínica

En `POST /auth/refresh`, si el refresh es `context = VETERINARY`, repetir los pasos 1–3 de USER-03 antes de emitir. Si ya no es miembro activo → revocar el refresh y responder `401` con código `VETERINARY_MEMBERSHIP_REVOKED` (la web debe mandar al selector de clínica).

### USER-05 — Cambiar de clínica / volver a modo usuario

- Cambiar de clínica = llamar de nuevo USER-03 con otro `veterinaryId` (revoca el refresh de contexto anterior).
- `POST /auth/context/user` devuelve un token base nuevo (para la app móvil o para salir del modo clínica).

### USER-06 — Endpoints internos de usuarios *(requerido por VET-20)*

Todos bajo `/internal/**` con `X-Internal-Api-Key`.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/internal/users/{id}` | `{ id, fullName, email, phone, emailVerified }` |
| POST | `/internal/users/batch` | body `{ ids: [] }` (máx. 100) → lista con los mismos campos |
| GET | `/internal/users/by-email?email=` | el usuario o `404` |

No exponer contraseñas, hashes, ni datos de autenticación.

### USER-07 — Proteger los endpoints propios con el nuevo JWT

1. Validar los propios tokens del servicio con el mismo mecanismo que los demás (resource server con JWKS local o el decoder directo).
2. Quitar cualquier `userId` que hoy venga en body/params para operaciones "sobre mí" (perfil, cambio de contraseña) y usar `sub`.
3. Rutas públicas: registro, login, refresh, verificación de email, recuperación de contraseña, JWKS.

### USER-08 — Eventos (opcional, recomendado)

Publicar `USER_EMAIL_VERIFIED` y `USER_REGISTERED` con el sobre común. Notifications puede usarlos para el correo de bienvenida.

---

### Tests mínimos

- Firma y verificación con la llave pública del JWKS.
- Token base trae todos los claims y `exp` de 15 min.
- Token de clínica: miembro activo → 200; no miembro → 403; clínica `REJECTED` → 403; Veterinary caído → 503.
- Refresh de clínica tras desactivar al empleado → 401 `VETERINARY_MEMBERSHIP_REVOKED`.
- Reutilización de refresh revocado → revoca la cadena.
- `/internal/**` sin API key → 401.

---

## 9. Cambios en pet-service (Pets) para MyAnimaLogVet


> Leer junto con `CLAUDE.md` del repo y `CONTRATOS_COMPARTIDOS.md`.
> Mantener las convenciones del repo: un `UseCase`/`Service`/`Controller`/`Request`/`Response` por operación, excepción de dominio + handler en `GlobalExceptionHandler`, evento vía `PublishPetEventUseCase`.
> **Recordatorio crítico del repo:** todo `eventType` nuevo debe agregarse a `TOPIC_BY_EVENT_TYPE` en `GooglePubSubPetEventAdapter` o se descarta en silencio. PETS-08 agrega un test para que eso no vuelva a pasar.

---

### PETS-01 — Validar el JWT *(requiere USER-01, USER-02)*

1. Agregar `spring-boot-starter-oauth2-resource-server` y `spring-security-test`.
2. Reescribir `SecurityConfig` igual que en Veterinary (`VETERINARY_SERVICE_PLAN.md §4.3`): JWKS, validación de `iss`/`aud`, `InternalApiKeyFilter` para `/internal/**`, `anyRequest().authenticated()`. Públicas: Swagger, actuator health/info.
3. Crear `AuthenticatedUserPort` + adaptador (mismo diseño que Veterinary §4.4).
4. Eliminar `jjwt` y `JWT_SECRET` al terminar.

### PETS-02 — Identidad desde el token en lugar del body

Reemplazar por `sub` del token **todos** estos campos, y quitarlos de los DTO de request:

| Dónde | Campo que se elimina |
|---|---|
| `AddPetRequest`, `EditPetRequest`, delete | `ownerId` |
| `UploadPetPhotoController` | `@RequestParam UUID ownerId` |
| `GrantAccessRequest`, `UpdateRole`, `RevokeAccess` (`?ownerId=`) | `ownerId` |
| `SendInvitation`, `ResendInvitation`, `GetPendingInvitationsByPet` | `ownerId` |
| `AcceptInvitation` | `userId` del body |
| `GetPendingInvitationsByEmail` | `{ email }` del body → usar `email` del token (y cambiar a `GET` sin body) |
| `UploadPetDocument` | `uploadedBy` |
| `GET /pets/user/{userId}` | reemplazar por `GET /pets/me` (el dueño solo lista lo suyo) |
| `GET /pets/shared?userId=` | reemplazar por `GET /pets/shared/me` |

**Corregir de paso el hueco conocido:** `AcceptInvitationService` debe verificar que el `email` del token sea igual a `invitation.email` (case-insensitive) y que `email_verified = true`. Nueva excepción `InvitationEmailMismatchException` → 403.

### PETS-03 — Lectura de mascotas por personal de una clínica *(requiere VET-29)*

Cuando llega un token con `ctx = VETERINARY`:

1. Nuevo puerto `VeterinaryAccessPort` con `check(veterinaryId, petId, userId)` → adaptador `RestClient` a `GET /internal/veterinaries/{vet}/patients/{pet}/access?userId=` con caché de 60 s (Caffeine).
2. En `GetPetById`, `CalculateAge`, `ListPetDocuments`, `ListPetDocumentsByType`, `GetPetDocumentById`, `GetDownloadUrl`: si el token es de clínica, permitir si `hasAccess` y tiene `CLINICAL_READ` o `CLINICAL_READ_BASIC` (para documentos: `CLINICAL_READ`).
3. `UploadPetDocument` con token de clínica: requiere `DOCUMENT_UPLOAD`. `uploadedBy` = `sub`. Agregar columna `uploaded_by_veterinary_id UUID` a `pet_documents`.
4. Con token de clínica **no** se permite: editar mascota, borrar mascota, foto de perfil, compartir, invitaciones, borrar documentos que no subió esa clínica.
5. Lógica centralizada en un servicio `PetAccessPolicy` (no repetir `if` en cada servicio).

### PETS-04 — Endpoints internos de lectura *(requerido por VET-25)*

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/internal/pets/{petId}/owner/{userId}` | `{ isOwner: bool }` (reutiliza `IsOwnerUseCase`) |
| POST | `/internal/pets/batch` | body `{ ids: [] }` (máx. 100) → `[{ id, ownerId, name, species, breed, sex, birthDate, photoUrl, createdByVeterinaryId, claimStatus }]` |

Los endpoints públicos `HasPermission` e `IsOwner` (`GET /pets/{petId}/access/{userId}`, `/owner/{userId}`) se mueven a `/internal/**`: hoy cualquiera puede consultar relaciones de cualquier usuario.

### PETS-05 — Mascotas registradas por una clínica (dueño sin app) *(requerido por VET-28)*

Migración (el repo no tiene Flyway; si se agrega, usar `V2__clinic_pets.sql`):

```sql
ALTER TABLE pets ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE pets
  ADD COLUMN created_by_veterinary_id UUID,
  ADD COLUMN owner_contact_name VARCHAR(200),
  ADD COLUMN owner_contact_phone VARCHAR(30),
  ADD COLUMN owner_contact_email VARCHAR(200),
  ADD COLUMN owner_contact_document VARCHAR(30),
  ADD COLUMN claim_status VARCHAR(20) NOT NULL DEFAULT 'NONE';  -- NONE, UNCLAIMED, CLAIMED
ALTER TABLE pets ADD CONSTRAINT chk_owner_or_clinic
  CHECK (owner_id IS NOT NULL OR created_by_veterinary_id IS NOT NULL);
```

- Actualizar `Pet` (dominio), `PetEntity`, mapper y DTOs de respuesta.
- **Revisar todo el código que asume `ownerId != null`**: `pet.getOwnerId().equals(...)` lanza `NullPointerException` con mascotas sin dueño. Invertir a `request.getOwnerId().equals(pet.getOwnerId())` o usar `Objects.equals`.
- Endpoints internos:

| Método | Ruta | Uso |
|---|---|---|
| POST | `/internal/pets/clinic` | Crea mascota con `owner_id = null`, `claim_status = UNCLAIMED`, `created_by_veterinary_id` y contacto. Valida igual que `AddPet`. Publica `PET_ADDED` con `userId = null` (no notificar) |
| DELETE | `/internal/pets/clinic/{petId}` | Compensación: solo borra si `claim_status = UNCLAIMED` y no tiene documentos |
| PATCH | `/internal/pets/clinic/{petId}` | Editar datos y contacto mientras siga `UNCLAIMED` (lo llama Veterinary con permiso `PATIENT_REGISTER`) |

### PETS-06 — Reclamar una mascota *(requerido por VET-28)*

```sql
CREATE TABLE pet_claim_invitations (
  id UUID PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id),
  veterinary_id UUID NOT NULL,
  email VARCHAR(200) NOT NULL,
  token UUID NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL,          -- PENDING, ACCEPTED, CANCELLED, EXPIRED
  expires_at TIMESTAMPTZ NOT NULL,       -- 30 días
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Método | Ruta | Token | Caso de uso |
|---|---|---|---|
| POST | `/internal/pets/{petId}/claim-invitations` | interno | `CreateClaimInvitation`: cancela las `PENDING` anteriores de esa mascota, crea una nueva, publica `PET_CLAIM_INVITATION_SENT` con `userId = null` y `recipient` = contacto del dueño, payload `{ petName, veterinaryName, claimUrl, expiresAt }` |
| GET | `/pets/claims/{token}` | base | `PreviewClaim`: datos básicos de la mascota y nombre de la clínica |
| POST | `/pets/claims/{token}/accept` | base | `AcceptClaim` |
| GET | `/pets/claims/me` | base | `GetMyPendingClaims` (por email del token) |

Reglas de `AcceptClaim`:
- Invitación `PENDING`, no vencida, mascota `UNCLAIMED`.
- `email` del token igual al de la invitación y `email_verified = true`.
- En una transacción: `owner_id = sub`, `claim_status = CLAIMED`, limpiar `owner_contact_*`, invitación `ACCEPTED`.
- Publica `PET_CLAIMED` con `userId = sub`.
- El texto en la app debe decir que la clínica que la registró **conserva el acceso** (y que puede revocarlo desde la app).

### PETS-07 — Migrar al sobre de evento común

1. Reemplazar `PetEvent` por el sobre de `CONTRATOS_COMPARTIDOS.md §4.1` (`eventType`, `userId`, `recipient`, `payload`, `occurredAt`, `metadata`).
2. `userId` = destinatario: por ejemplo, en `PET_INVITATION_SENT` el destinatario es el invitado (`null` + `recipient.email`), no el dueño.
3. Incluir detalle en `payload` (email invitado, rol, nombre del documento, etc.), que hoy no viaja.
4. Coordinar con NOTIF-01: el consumidor debe aceptar el sobre nuevo antes del despliegue.

### PETS-08 — Topics nuevos y test de cobertura

1. Agregar a `TOPIC_BY_EVENT_TYPE`: `PET_CLAIM_INVITATION_SENT → pet-claim-invitation-sent`, `PET_CLAIMED → pet-claimed`, `PET_DOCUMENT_UPLOADED_BY_CLINIC → pet-document-uploaded`.
2. Convertir los `eventType` en un enum y agregar un test que falle si algún valor no tiene topic.
3. Crear los topics en GCP: `gcloud pubsub topics create pet-claim-invitation-sent pet-claimed`.

---

### Tests mínimos

- Cada endpoint que antes recibía `ownerId` ahora usa el token: otro usuario → 403.
- `AcceptInvitation` con email distinto → 403.
- Token de clínica con acceso → lee la mascota; sin acceso → 403; intenta editar → 403.
- Mascota de clínica sin dueño no rompe ningún servicio (NPE).
- Reclamo: email distinto → 403; vencido → error; aceptado → `ownerId` asignado y evento publicado.
- Test de cobertura de topics.

---

## 10. Cambios en medical-pet-backend para MyAnimaLogVet


> Leer junto con `AGENTS.md` del repo (fuente de verdad) y `CONTRATOS_COMPARTIDOS.md`.
> Stack: Next.js 16 route handlers + TypeScript + Supabase. Mantener Clean Architecture: la validación del token y la consulta de permisos son infraestructura; los use-cases reciben un `actor` ya resuelto.
> Mantener la regla del repo: un fallo de Pub/Sub nunca tumba la respuesta HTTP.

---

### MED-01 — Validar el JWT *(requiere USER-01, USER-02)*

1. `npm i jose`.
2. `src/infrastructure/auth/jwt.ts`:
   ```ts
   import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

   const JWKS = createRemoteJWKSet(new URL(process.env.JWT_JWKS_URI!));

   export interface Actor {
     userId: string;
     email: string;
     platformRole: 'USER' | 'PLATFORM_ADMIN';
     clinic?: { veterinaryId: string; employeeId: string; role: string; licensed: boolean; status: string };
   }

   export async function authenticate(req: Request): Promise<Actor> {
     const header = req.headers.get('authorization');
     if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();
     const { payload } = await jwtVerify(header.slice(7), JWKS, {
       issuer: 'myanimalog-user-service',
       audience: 'myanimalog-api',
     });
     return toActor(payload);
   }
   ```
3. Helper `withAuth(handler)` para envolver cada `route.ts` y mapear `UnauthorizedError` → 401, `ForbiddenError` → 403.
4. Rutas `/api/cron/**`: no usan JWT de usuario; exigir `X-Internal-Api-Key` (hoy cualquiera puede dispararlas).
5. Variables nuevas: `JWT_JWKS_URI`, `INTERNAL_API_KEY`, `VETERINARY_SERVICE_URL`, `PETS_SERVICE_URL`. Son de runtime: **no** usar prefijo `NEXT_PUBLIC_` (se incrustarían en el bundle).

### MED-02 — Columnas de autoría y clínica

Migración en el Supabase de Medical:

```sql
ALTER TABLE veterinary_visits
  ADD COLUMN veterinary_id UUID,
  ADD COLUMN attended_by_employee_id UUID,
  ADD COLUMN attended_by_user_id UUID,
  ADD COLUMN appointment_id UUID,
  ADD COLUMN created_by_user_id UUID;
CREATE INDEX ix_visits_vet_date ON veterinary_visits(veterinary_id, visit_date);

ALTER TABLE vaccines
  ADD COLUMN veterinary_id UUID,
  ADD COLUMN applied_by_employee_id UUID,
  ADD COLUMN batch_number VARCHAR(50),        -- lote: obligatorio para carnet de vacunas
  ADD COLUMN manufacturer VARCHAR(100);

ALTER TABLE pet_surgeries
  ADD COLUMN veterinary_id UUID,
  ADD COLUMN surgeon_employee_id UUID;

ALTER TABLE lab_tests ADD COLUMN veterinary_id UUID, ADD COLUMN pet_id UUID, ADD COLUMN user_id UUID;
ALTER TABLE "WeightRecord" ADD COLUMN "VeterinaryId" UUID, ADD COLUMN "Source" VARCHAR(10) DEFAULT 'CLINIC'; -- CLINIC | OWNER

CREATE TABLE clinical_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(10) NOT NULL,                -- CREATE, UPDATE, DELETE
  actor_user_id UUID NOT NULL,
  veterinary_id UUID,
  changes JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seguir el patrón de `vaccines.user_id` documentado en `AGENTS.md §6`: entidad → mapper → insert → `mapToX` lee de vuelta. Resolver de paso la deuda de `lab_tests` sin `pet_id`/`user_id` (§10 del AGENTS.md).

### MED-03 — Autorización por actor *(requiere VET-29, PETS-04)*

Crear `src/infrastructure/auth/access.service.ts` con caché en memoria de 60 s:

```ts
export async function requireClinicalAccess(actor: Actor, petId: string, permission: Permission) {
  if (!actor.clinic) throw new ForbiddenError('Se requiere token de clínica');
  const res = await fetch(
    `${process.env.VETERINARY_SERVICE_URL}/internal/veterinaries/${actor.clinic.veterinaryId}/patients/${petId}/access?userId=${actor.userId}`,
    { headers: { 'X-Internal-Api-Key': process.env.INTERNAL_API_KEY! }, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new ServiceUnavailableError();
  const access = await res.json();
  if (!access.hasAccess || !access.permissions.includes(permission)) throw new ForbiddenError();
  return access;
}

export async function requireOwner(actor: Actor, petId: string) {
  // GET {PETS_SERVICE_URL}/internal/pets/{petId}/owner/{actor.userId}
}
```

Matriz por ruta:

| Ruta | Dueño (token base) | Clínica (token de clínica) |
|---|---|---|
| `GET` visitas, tratamientos, cirugías, labs, vacunas, peso | `requireOwner` | `CLINICAL_READ` |
| `POST/PUT` visitas, tratamientos, medicación, cirugías, labs | ❌ 403 | `CLINICAL_WRITE` |
| `POST/PUT` vacunas | ❌ 403 | `NURSING_WRITE` |
| `POST` peso | ✅ con `Source = OWNER` | `NURSING_WRITE` con `Source = CLINIC` |
| `DELETE` cirugía | ❌ | `CLINICAL_WRITE` y misma `veterinary_id` que la creó |
| `/api/cron/**` | — | solo `X-Internal-Api-Key` |

Con token de clínica, **siempre** guardar `veterinary_id = actor.clinic.veterinaryId` y el empleado como autor. Nunca tomarlos del body.

Para rutas que reciben un id de registro (ej. `PUT /api/treatments/[id]`) y no el `petId`: leer primero el registro para obtener su `pet_id` y luego autorizar.

### MED-04 — Visita desde una cita

- `POST /api/visits` acepta `appointmentId` opcional. Si viene, se guarda; la clínica la crea **después** de marcar la cita como atendida en Calendar (no se crean visitas vacías automáticas).
- Validar que no exista ya una visita con ese `appointment_id` (409).

### MED-05 — Auditoría

En cada use-case de escritura, insertar en `clinical_audit_log` (repositorio nuevo `SupabaseAuditLogRepository`). En `UPDATE`, guardar en `changes` el antes/después de los campos modificados. Una historia clínica editada sin rastro no es aceptable.

### MED-06 — Eventos con contexto de clínica

1. Agregar `veterinaryId` y `veterinaryName` en `metadata`/`payload` de los eventos existentes cuando el actor es una clínica (`VACCINE_APPLIED`, `VISIT_COMPLETED`, `TREATMENT_STARTED`, `SURGERY_SCHEDULED`…), para que la notificación diga "Clínica Patitas aplicó la vacuna antirrábica a Max".
2. `userId` del evento = **dueño de la mascota**, obtenido de Pets (`/internal/pets/batch`), ya no del body. Si la mascota no tiene dueño (`claim_status = UNCLAIMED`), `userId = null` y `recipient` con el contacto que devuelve Pets.
3. Adoptar el sobre común (`CONTRATOS_COMPARTIDOS.md §4.1`): agregar `recipient` al `publishDomainEvent`.

### MED-07 — Consultas para la clínica

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/visits/veterinary/[veterinaryId]?from=&to=` | token de clínica de esa clínica, `CLINICAL_READ` (verificar `vet_id` del token = ruta) |
| GET | `/api/pets/[petId]/clinical-summary` | `CLINICAL_READ_BASIC`: alergias, vacunas vigentes/vencidas, tratamientos activos, último peso |

`clinical-summary` es lo que ve recepción y lo que puede consumir el IA service para el resumen previo a la cita.

---

### Tests mínimos (Jest, en `__test__/`)

- `authenticate`: token válido, vencido, firma inválida, `aud` incorrecto.
- `requireClinicalAccess`: con permiso, sin permiso, sin acceso, Veterinary caído → 503.
- Use-case de visita guarda `veterinary_id` y autor desde el actor aunque el body traiga otro.
- Auditoría se escribe en create y update.
- Recepcionista (`CLINICAL_READ_BASIC` sin `CLINICAL_READ`) recibe 403 en historia completa pero 200 en `clinical-summary`.

---

## 11. Cambios en el servicio de calendario / citas para MyAnimaLogVet


> Leer junto con `CONTRATOS_COMPARTIDOS.md`. No se tuvo acceso a la documentación de este servicio.
> Si el calendario existente es en realidad el módulo de visitas de Medical (`VISIT_SCHEDULED`, `/api/cron/visit-reminders`), la recomendación es **no** usar visitas como citas: la cita es agenda, la visita es el registro clínico. En ese caso, implementar este documento como módulo `appointments` dentro de Veterinary (opción B de `VETERINARY_SERVICE_PLAN.md §10`) y dejar los recordatorios de visita de Medical solo para controles clínicos ("volver en 15 días").

---

### CAL-01 — Validar el JWT *(requiere USER-01, USER-02)*

Mismo patrón que los demás: JWKS, `iss`, `aud`, `X-Internal-Api-Key` para `/internal/**` y jobs.

### CAL-02 — Autorización *(requiere VET-29)*

- Token de clínica: toda operación sobre citas de la clínica requiere `APPOINTMENT_MANAGE` y `vet_id` = `veterinaryId` de la ruta. Para operaciones sobre una mascota concreta, consultar el endpoint `access` de Veterinary (caché 60 s).
- Token base (dueño): solo puede solicitar, ver y cancelar citas de **sus** mascotas (`/internal/pets/{petId}/owner/{userId}` en Pets) en clínicas `ACTIVE` con `allowOnlineBooking = true`, y la mascota debe estar compartida con esa clínica.

### CAL-03 — Modelo de cita *(requiere VET-33)*

```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  veterinary_id UUID NOT NULL,
  employee_id UUID,                      -- veterinario asignado (null = cualquiera disponible)
  pet_id UUID NOT NULL,
  owner_user_id UUID,                    -- null si el dueño no tiene app
  service_id UUID NOT NULL,
  service_name VARCHAR(120) NOT NULL,    -- snapshot
  duration_minutes INT NOT NULL,         -- snapshot
  price NUMERIC(12,2),                   -- snapshot
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL,           -- REQUESTED, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW, REJECTED
  origin VARCHAR(10) NOT NULL,           -- APP, CLINIC
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(10),              -- OWNER, CLINIC
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_appt_vet_time ON appointments(veterinary_id, starts_at);
CREATE INDEX ix_appt_employee_time ON appointments(employee_id, starts_at);
-- evitar doble reserva del mismo veterinario (requiere extensión btree_gist)
ALTER TABLE appointments ADD CONSTRAINT no_overlap EXCLUDE USING gist (
  employee_id WITH =, tstzrange(starts_at, ends_at) WITH &&
) WHERE (status IN ('REQUESTED','CONFIRMED','CHECKED_IN'));
```

Precio, nombre y duración del servicio se copian al crear la cita: si la clínica cambia el precio después, la cita conserva el original.

#### Transiciones permitidas

```
REQUESTED ──confirm──▶ CONFIRMED ──check-in──▶ CHECKED_IN ──complete──▶ COMPLETED
    │                     │    └──no-show──▶ NO_SHOW
    └──reject──▶ REJECTED └──cancel──▶ CANCELLED (también desde REQUESTED)
```

- Cita creada por la clínica nace `CONFIRMED`. Cita desde la app nace `REQUESTED` si `bookingRequiresConfirmation`, si no `CONFIRMED`.
- El dueño solo puede cancelar con al menos `cancellationMinHours` de anticipación.
- `NO_SHOW` solo después de `starts_at`.

### CAL-04 — Disponibilidad

`GET /veterinaries/{veterinaryId}/availability?serviceId=&date=&employeeId=` (dueño o clínica)

1. Pedir `GET /internal/veterinaries/{id}/schedule-rules?from=&to=&employeeId=` a Veterinary (caché 5 min).
2. Generar franjas de `durationMinutes` dentro de `businessHours` ∩ horario del empleado, restar `blocks` y citas activas.
3. No ofrecer franjas en el pasado ni con menos de 1 hora de anticipación para reservas desde la app.
4. Respuesta: `[{ startsAt, endsAt, employeeId, employeeName }]` en la zona horaria de la clínica.

### CAL-05 — Endpoints

| Método | Ruta | Quién | Acción |
|---|---|---|---|
| GET | `/veterinaries/{id}/availability` | dueño / clínica | Franjas libres |
| POST | `/veterinaries/{id}/appointments` | clínica | Crear (nace `CONFIRMED`) |
| POST | `/veterinaries/{id}/appointment-requests` | dueño | Solicitar desde la app |
| GET | `/veterinaries/{id}/appointments?from=&to=&employeeId=&status=` | clínica | Agenda (día, semana, por veterinario) |
| GET | `/me/appointments` | dueño | Mis citas en todas las clínicas |
| PATCH | `/veterinaries/{id}/appointments/{aid}/confirm` | clínica | Confirmar |
| PATCH | `/veterinaries/{id}/appointments/{aid}/reject` | clínica | Rechazar (con motivo) |
| PATCH | `/veterinaries/{id}/appointments/{aid}/reschedule` | clínica / dueño | Reprogramar (revalida disponibilidad) |
| PATCH | `/veterinaries/{id}/appointments/{aid}/cancel` | clínica / dueño | Cancelar |
| PATCH | `/veterinaries/{id}/appointments/{aid}/check-in` | clínica | Llegó |
| PATCH | `/veterinaries/{id}/appointments/{aid}/complete` | clínica | Atendida → la web abre el formulario de visita en Medical con `appointmentId` |
| PATCH | `/veterinaries/{id}/appointments/{aid}/no-show` | clínica | No asistió |
| POST | `/internal/jobs/appointments/reminders` | Cloud Scheduler | Recordatorios |

### CAL-06 — Eventos y recordatorios

Topic `veterinary-appointments`, sobre común. `userId` = dueño (o `null` + `recipient` con el contacto si no tiene app, obtenido de Pets). Payload siempre con `veterinaryName`, `address`, `phone`, `petName`, `serviceName`, `startsAt`, `timezone`.

| Evento | Cuándo |
|---|---|
| `APPOINTMENT_REQUESTED` | Dueño solicita (destinatario: la clínica) |
| `APPOINTMENT_CONFIRMED` | Clínica confirma o crea |
| `APPOINTMENT_REJECTED` | Clínica rechaza |
| `APPOINTMENT_RESCHEDULED` | Cambio de hora |
| `APPOINTMENT_CANCELLED` | Cualquiera cancela (destinatario: la otra parte) |
| `APPOINTMENT_REMINDER` | Job cada hora: citas `CONFIRMED` que empiezan en 23–24 h, marcar `reminder_sent_at` para no repetir |
| `APPOINTMENT_COMPLETED` | Atendida (sirve para encuesta de satisfacción a futuro) |

---

### Tests mínimos

- Doble reserva del mismo veterinario en la misma franja → rechazada por la base.
- Disponibilidad respeta horario, bloqueos y citas existentes.
- Dueño cancelando fuera de plazo → error.
- Recepcionista de otra clínica → 403.
- Job de recordatorios corrido dos veces → un solo evento por cita.

---

## 12. Cambios en notification-microservice-pubsub para MyAnimaLogVet


> Leer junto con `CONTRATOS_COMPARTIDOS.md`. No se tuvo acceso al `CLAUDE.md` de este repo; se describe el contrato y el comportamiento esperado.
> Este servicio **no** decide reglas de negocio: recibe eventos y los convierte en mensajes. Todo lo que necesita para armar el mensaje viene en el `payload`.

---

### NOTIF-01 — Aceptar el sobre común

1. Parsear el sobre de `CONTRATOS_COMPARTIDOS.md §4.1`. Mantener compatibilidad temporal con el formato viejo de Pets (`PetEvent`) hasta que PETS-07 esté desplegado.
2. **Cambio de regla:** hoy un evento sin `userId` se descarta (`evento sin userId, se descarta`). Nueva regla:
   - `userId` presente → resolver contacto y preferencias del usuario.
   - `userId = null` y `recipient.email` o `recipient.phone` presente → enviar directo a ese contacto (dueños sin app, empleados invitados, soporte).
   - Ambos vacíos → descartar y loguear como error con `eventType` y `metadata.source`.
3. Idempotencia: guardar `messageId` de Pub/Sub procesados (tabla `processed_messages`, TTL 7 días) para no enviar dos veces el mismo correo si Pub/Sub reentrega.

### NOTIF-02 — Suscripciones nuevas

```bash
for t in veterinary-clinic veterinary-verification veterinary-staff veterinary-patients \
         veterinary-subscription veterinary-appointments pet-claim-invitation-sent pet-claimed; do
  gcloud pubsub topics create $t 2>/dev/null
  gcloud pubsub subscriptions create sub-notificaciones-$t --topic=$t --ack-deadline=60
done
```

Configurar dead-letter topic (`notifications-dlq`, máx. 5 intentos) para no perder eventos que fallan repetidamente.

### NOTIF-03 — Plantillas

Una plantilla por evento, en español, con variables del `payload`. Canales MVP: email y push.

| Evento | Canal | Asunto / título | Variables |
|---|---|---|---|
| `VETERINARY_REGISTERED` | email | Tu clínica fue creada: sube tus documentos | name |
| `VERIFICATION_SUBMITTED` | email (soporte) | Nueva verificación pendiente | subjectType, veterinaryName, adminUrl |
| `VERIFICATION_APPROVED` | email + push | ¡Tu clínica fue aprobada! | veterinaryName, trialEndsAt |
| `VERIFICATION_REJECTED` | email | Tu solicitud no fue aprobada | reason |
| `VERIFICATION_CORRECTION_REQUESTED` | email | Necesitamos que corrijas unos documentos | notes, documentTypes |
| `EMPLOYEE_INVITED` | email | {veterinaryName} te invita a su equipo | role, acceptUrl, expiresAt |
| `EMPLOYEE_JOINED` | email | {employeeName} se unió a tu equipo | role |
| `EMPLOYEE_ROLE_UPDATED` | push | Tu rol cambió | newRole |
| `OWNERSHIP_TRANSFERRED` | email | Ahora eres el propietario de {veterinaryName} | — |
| `USER_LINKED` | push | Te vinculaste a {veterinaryName} | — |
| `PET_SHARED_WITH_VETERINARY` | push | {veterinaryName} ya puede ver la historia de {petName} | — |
| `PET_CLAIM_INVITATION_SENT` | email | {veterinaryName} registró a {petName}: reclámalo en MyAnimaLog | claimUrl, expiresAt |
| `PET_CLAIMED` | push | {petName} ya es parte de tu cuenta | — |
| `APPOINTMENT_REQUESTED` | push (clínica) | Nueva solicitud de cita | petName, serviceName, startsAt |
| `APPOINTMENT_CONFIRMED` | email + push | Cita confirmada | veterinaryName, petName, startsAt, address |
| `APPOINTMENT_RESCHEDULED` | email + push | Tu cita cambió de hora | oldStartsAt, startsAt |
| `APPOINTMENT_CANCELLED` | email + push | Cita cancelada | reason |
| `APPOINTMENT_REMINDER` | email + push | Recordatorio: mañana tienes cita | startsAt, address, phone |
| `SUBSCRIPTION_TRIAL_STARTED` | email | Tu prueba de 30 días empezó | trialEndsAt |
| `SUBSCRIPTION_EXPIRING` | email | Tu plan vence en 7 días | planName, date, checkoutUrl |
| `SUBSCRIPTION_IN_GRACE` / `_EXPIRED` | email | Tu plan venció | planName |
| `SUBSCRIPTION_RENEWED` | email | Pago recibido | amount, planName |
| `PAYMENT_FAILED` | email | No pudimos procesar tu pago | — |

Fechas en el mensaje con la zona horaria de la clínica (`payload.timezone` o `America/Bogota`).

### NOTIF-04 — Destinatarios del lado clínica

Algunos eventos van a "la clínica" (ej. `APPOINTMENT_REQUESTED`). Para esos el emisor publica con `userId` del empleado responsable o con `recipient.email` = email de la clínica. Notifications no consulta a Veterinary para decidir a quién.

### NOTIF-05 — Escalado en Cloud Run

Como documenta `AGENTS.md §12` de Medical: con suscripción **pull** el servicio escala a cero y deja de procesar. Elegir una:
- `--min-instances=1 --no-cpu-throttling`, o
- cambiar las suscripciones a **push** hacia un endpoint HTTPS del servicio (autenticado con el service account de Pub/Sub).

### NOTIF-06 — WhatsApp (fase posterior, feature `WHATSAPP` del plan PRO)

- Adaptador nuevo detrás de un puerto `MessageChannel` (WhatsApp Business Cloud API de Meta o un proveedor como Twilio).
- Solo para `APPOINTMENT_REMINDER`, `APPOINTMENT_CONFIRMED`, `VACCINE_DUE_REMINDER`.
- Requiere plantillas aprobadas por Meta y opt-in del dueño. Enviar solo si `payload.channels` incluye `WHATSAPP` (lo decide el emisor según el plan de la clínica).

---

### Tests mínimos

- Evento con `userId` → usa contacto del usuario.
- Evento sin `userId` con `recipient` → envía al contacto.
- Evento sin ambos → descartado y logueado.
- Mismo `messageId` dos veces → un solo envío.
- Cada plantilla renderiza con un payload de ejemplo sin variables vacías.

---

## 13. Cambios en IA-service para MyAnimaLogVet


> Leer junto con `CONTRATOS_COMPARTIDOS.md`. No se tuvo acceso al `CLAUDE.md` de este repo; se describe el contrato.
> **Principio no negociable:** la IA **asiste** al revisor humano, **nunca aprueba ni rechaza**. Su salida es un reporte de apoyo que se guarda en `verification_requests.ai_report`. La decisión final la toma un `PLATFORM_ADMIN` después de confirmar en el portal oficial de COMVEZCOL.

---

### IA-01 — Pre-análisis de documentos de verificación

`POST /internal/verification/analyze` — `X-Internal-Api-Key`, timeout del lado de Veterinary: 60 s.

#### Request

```json
{
  "requestId": "uuid",
  "subjectType": "CLINIC",
  "declared": {
    "clinicName": "Clínica Veterinaria Patitas",
    "legalName": "Patitas SAS",
    "nit": "901234567-8",
    "legalRepName": "Ana María Gómez",
    "legalRepDocument": "1047000000",
    "city": "Cartagena",
    "professional": {
      "fullName": "Ana María Gómez",
      "documentNumber": "1047000000",
      "licenseNumber": "12345",
      "profession": "MV"
    }
  },
  "documents": [
    { "documentId": "uuid", "type": "RUT", "mimeType": "application/pdf", "signedUrl": "https://…(10 min)" },
    { "documentId": "uuid", "type": "CHAMBER_OF_COMMERCE", "mimeType": "application/pdf", "signedUrl": "…" },
    { "documentId": "uuid", "type": "LEGAL_REP_ID", "mimeType": "image/jpeg", "signedUrl": "…" },
    { "documentId": "uuid", "type": "PROFESSIONAL_CARD", "mimeType": "image/jpeg", "signedUrl": "…" }
  ]
}
```

#### Response

```json
{
  "requestId": "uuid",
  "modelVersion": "nombre-del-modelo@fecha",
  "documents": [
    {
      "documentId": "uuid",
      "detectedType": "RUT",
      "typeMatches": true,
      "legible": true,
      "extracted": { "nit": "901234567-8", "razonSocial": "PATITAS SAS", "actividadPrincipal": "7500" },
      "issueDate": "2026-08-14",
      "warnings": []
    },
    {
      "documentId": "uuid",
      "detectedType": "CHAMBER_OF_COMMERCE",
      "typeMatches": true,
      "legible": true,
      "extracted": { "razonSocial": "PATITAS SAS", "representanteLegal": "ANA MARIA GOMEZ", "fechaExpedicion": "2026-03-02" },
      "warnings": ["El certificado tiene más de 30 días de expedido"]
    }
  ],
  "crossChecks": [
    { "check": "NIT_MATCHES_DECLARED", "result": "PASS" },
    { "check": "LEGAL_NAME_MATCHES_ACROSS_DOCUMENTS", "result": "PASS" },
    { "check": "LEGAL_REP_MATCHES_ID_DOCUMENT", "result": "PASS" },
    { "check": "PROFESSIONAL_NAME_MATCHES_ID", "result": "WARN", "detail": "Segundo apellido no visible en la tarjeta" },
    { "check": "LICENSE_NUMBER_MATCHES_DECLARED", "result": "PASS" },
    { "check": "RUT_ACTIVITY_IS_VETERINARY", "result": "PASS" }
  ],
  "riskLevel": "LOW",
  "summaryForReviewer": "Documentos legibles y consistentes. Verificar en el portal de COMVEZCOL la tarjeta 12345 a nombre de Ana María Gómez.",
  "recommendation": "READY_FOR_HUMAN_REVIEW"
}
```

- `recommendation` solo puede ser `READY_FOR_HUMAN_REVIEW` o `NEEDS_ATTENTION`. **No existe** `APPROVE` ni `REJECT`.
- `riskLevel`: `LOW` (todo consistente), `MEDIUM` (advertencias menores, ilegible parcial, certificado viejo), `HIGH` (datos que no coinciden, tipo de documento equivocado, señales de edición).

#### Checks a implementar

| Check | Qué valida |
|---|---|
| `TYPE_MATCHES` | El documento subido es del tipo declarado (no una foto cualquiera como "RUT") |
| `LEGIBLE` | Texto legible, documento completo, no recortado |
| `NIT_MATCHES_DECLARED` | NIT del RUT = NIT declarado (incluido dígito de verificación) |
| `LEGAL_NAME_MATCHES_ACROSS_DOCUMENTS` | Razón social igual en RUT y Cámara de Comercio |
| `LEGAL_REP_MATCHES_ID_DOCUMENT` | Representante legal del certificado = nombre/número de la cédula |
| `CHAMBER_CERT_RECENT` | Certificado de Cámara de Comercio con expedición reciente (umbral configurable, ej. 30–90 días) |
| `RUT_ACTIVITY_IS_VETERINARY` | Actividad económica relacionada con actividades veterinarias |
| `PROFESSIONAL_NAME_MATCHES_ID` | Nombre de la tarjeta profesional = cédula |
| `LICENSE_NUMBER_MATCHES_DECLARED` | Número de tarjeta = el declarado |
| `VISUAL_TAMPERING_SIGNALS` | Señales visibles de edición (tipografías mezcladas, recortes, zonas pixeladas). Solo genera `WARN`, nunca conclusión |

#### Implementación sugerida

1. Descargar cada documento desde la `signedUrl` (no guardarlo en disco; procesarlo en memoria y descartarlo).
2. PDF → texto (si tiene capa de texto) o imagen por página; imágenes tal cual.
3. Enviar a un modelo con visión con **salida estructurada en JSON**, un documento a la vez para extracción, y luego una segunda llamada con todos los `extracted` + `declared` para los `crossChecks` (o hacerlos en código cuando son comparaciones exactas: NIT, números de documento).
4. Normalizar antes de comparar: mayúsculas, sin tildes, sin puntos ni espacios en números.
5. Validar la respuesta del modelo contra un esquema; si no cumple, reintentar una vez y si no, devolver `500` (Veterinary marca `ai_status = FAILED` y el humano revisa sin reporte).

#### Privacidad (datos personales sensibles)

- No loguear contenido de documentos ni datos extraídos; solo `requestId`, duración y resultado.
- No usar los documentos para entrenamiento ni guardarlos en el IA service.
- El aviso de tratamiento de datos que acepta la clínica al registrarse debe mencionar que los documentos se analizan con IA como apoyo a la revisión.

### IA-02 — Resumen clínico antes de la cita (fase posterior, feature `AI_SUMMARY`)

`POST /internal/clinical/summary` — recibe la salida de `GET /api/pets/[petId]/clinical-summary` de Medical (MED-07) y devuelve un resumen de 5–8 líneas para el veterinario. Siempre con la advertencia de que es un apoyo y debe verificarse con la historia.

---

### Tests mínimos

- Documentos de ejemplo consistentes → `riskLevel = LOW`.
- NIT distinto al declarado → check `FAIL` y `riskLevel = HIGH`.
- Imagen que no es un RUT subida como RUT → `typeMatches = false`.
- Respuesta del modelo con formato inválido → un reintento y luego 500.
- La respuesta nunca contiene `APPROVE`/`REJECT`.
