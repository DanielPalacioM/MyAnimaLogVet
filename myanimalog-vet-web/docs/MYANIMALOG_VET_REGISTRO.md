# MyAnimaLogVet — Registro de la clínica

> Todos los campos, pasos, estados y reglas del registro y la verificación de una clínica veterinaria (panel web MyAnimaLogVet).
> Fuentes: `MYANIMALOG_VET_DISENO.md` §6–7, `MYANIMALOG_VET_ESTADO.md` §2, `MYANIMALOG_VET_MAESTRO.md` §4, §5 y §7, `MYANIMALOG_VET_BRECHAS.md` §4 y §6, y la guía del backend del 13 oct.
> Los campos de cada paso salen de la descripción de los docs. **No se revisaron uno por uno contra los frames de Figma**: si el frame tiene un campo que no aparece aquí, manda el frame.
> Fecha: 15 de octubre de 2026.

## Índice

1. Resumen del flujo
2. Pasos y campos
3. Documentos
4. Estados después de enviar
5. Reglas de negocio
6. Datos en el backend
7. Endpoints
8. Medidas del diseño
9. Brechas del registro

---

## 1. Resumen del flujo

```
Antes de empezar → 1 Cuenta → 2 Tu clínica → 3 Representante → 4 Documentos → 5 Perfil profesional → 6 Revisar y enviar
                                                                                                              │
                                              En revisión ◀───────────────────────────────────────────────────┘
                                              ├─▶ Corrección ──▶ (reenvía) ──▶ En revisión
                                              ├─▶ Aprobada (ACTIVE, prueba PRO de 30 días)
                                              └─▶ Rechazada (máx. 3 intentos)
```

Indicador arriba: "PASO N DE 6" y barra morada. Botones Atrás / Continuar abajo.

| # | Pantalla | Frame de Figma |
|---|---|---|
| — | Antes de empezar | `1861:19` |
| 1 | Crea tu cuenta | `1899:73` |
| 2 | Tu clínica | `1901:132` |
| 3 | Representante legal | `1902:215` |
| 4 | Documentos | `1910:20` |
| 5 | Perfil profesional | `1910:131` |
| 6 | Revisa y envía | `1910:244` |
| — | Estado: en revisión | `1911:109` |
| — | Estado: corrige y reenvía | `1911:198` |
| — | Estado: ¡Aprobada! | `1911:303` |
| — | Estado: no aprobada | `1911:368` |

Extras del 13 oct (pantallas de entrada al panel): "Verifica tu correo antes de registrar" `2035:313`, "Elige tu clínica: sin clínicas" `2035:284`.

---

## 2. Pasos y campos

### Antes de empezar (`1861:19`)

Aviso de tratamiento de datos. Debe mencionar la Ley 1581 y que los documentos se analizan con IA como apoyo a la revisión.

| Campo | Tipo | Obligatorio |
|---|---|---|
| Acepto el tratamiento de datos | Casilla | Sí |
| Segunda casilla obligatoria (el texto exacto está en el frame) | Casilla | Sí |

### Antes del paso 1: correo verificado

`POST /api/veterinary/register` exige `email_verified = true` en el token. Si el correo no está verificado, el panel muestra "Verifica tu correo antes de registrar" (`2035:313`).

### Paso 1 · Crea tu cuenta (`1899:73`)

| Campo | Tipo | Notas |
|---|---|---|
| Nombre | Texto | |
| Correo | Correo | |
| Contraseña | Contraseña | |

### Paso 2 · Tu clínica (`1901:132`)

| Campo | Tipo | Notas |
|---|---|---|
| Nombre comercial | Texto | Único. Columna `name` |
| Razón social | Texto | `legal_name` |
| NIT | Texto | Formato `\d{9}-\d`. Único. Se valida con el algoritmo del dígito de verificación de la DIAN (value object `Nit`) |
| Dígito de verificación (DV) | Texto | Va junto al NIT |
| Teléfono | Teléfono | `phone` |
| Correo de la clínica | Correo | Único |
| Departamento | Desplegable | `department` |
| Ciudad | Desplegable | `city` |
| Logo | Imagen | Opcional. PNG, JPEG o WEBP, hasta 2 MB. Bucket público `veterinary-logos` |
| Dirección | Texto | `address` |
| Ubicación en el mapa | Mapa con pin | Guarda `latitude` y `longitude` |

### Paso 3 · Representante legal (`1902:215`)

| Campo | Tipo | Notas |
|---|---|---|
| ¿Eres tú el representante legal? | Sí / No | Si es Sí, se prellenan los datos del paso 1 |
| Nombre completo del representante | Texto | Se compara con la cédula y la Cámara de Comercio |
| Tipo de documento | Desplegable | `CC`, `CE`, `PPT` |
| Número de documento | Texto | Se compara con la cédula subida |

### Paso 4 · Documentos (`1910:20`)

| Documento | Tipo en el backend | Obligatorio |
|---|---|---|
| RUT | `RUT` | Sí |
| Cámara de Comercio (certificado de existencia y representación legal, o matrícula mercantil si es persona natural) | `CHAMBER_OF_COMMERCE` | Sí |
| Cédula del representante legal | `LEGAL_REP_ID` | Sí |
| Foto de la fachada | `FACADE_PHOTO` | No |

Archivos: PDF, JPEG o PNG, hasta 10 MB. Cada documento tiene tres estados: Pendiente, Listo y Corregir (ver §3).

### Paso 5 · Perfil profesional (`1910:131`)

Es la verificación del profesional que firma historias clínicas. La licencia es de la persona, no de la clínica: se verifica una sola vez aunque trabaje en varias.

| Campo | Tipo | Notas |
|---|---|---|
| ¿Eres veterinario? | Sí / No | Si es No, este paso se salta y el perfil se hace luego |
| Profesión | Desplegable | `MV` (médico veterinario) o `MVZ` (médico veterinario zootecnista) |
| Número de tarjeta profesional | Texto | `license_number`. Único en la plataforma. Si cambia después, el estado vuelve a `NOT_SUBMITTED` |
| Especialidad | Texto | Opcional |
| Universidad | Texto | Opcional |
| Tarjeta profesional (archivo) | Documento | `PROFESSIONAL_CARD`. Obligatorio si es veterinario |
| Cédula (archivo) | Documento | `ID_DOCUMENT`. Obligatorio si es veterinario |
| Título (archivo) | Documento | `DEGREE`. Opcional |

Datos que el backend también guarda del perfil y que se piden aparte: nombre completo, tipo y número de documento (se reutilizan del paso 3 si "eres tú"), y la firma (PNG, bucket privado, para fórmulas y certificados), que se sube después desde "Mi perfil profesional" (`2039:267`).

### Paso 6 · Revisa y envía (`1910:244`)

| Elemento | Notas |
|---|---|
| Resumen de lo ingresado | Cada bloque con enlace "Editar" que lleva al paso correspondiente |
| Declaración de veracidad | Casilla obligatoria |
| Botón "Enviar a verificación" | Pasa la clínica a `UNDER_REVIEW` |

Al enviar el backend exige todos los documentos obligatorios. Si el dueño de la clínica declaró ser veterinario, su perfil profesional se envía en el mismo paso.

---

## 3. Documentos

### Estados de cada documento

| Estado | Borde | Fondo | Texto / ícono | Acción |
|---|---|---|---|---|
| Pendiente | `#000000` | `#FFFFFF` | Botón "Subir" en `#4037BE` | Subir |
| Listo | `#000000` | `#FFFFFF` | Chip `#E0FFFA` con texto `#00796B` | Reemplazar |
| Corregir | `#F5A623` | `#FFF7EA` | Botón "Volver a subir" `#F5A623` | Volver a subir |

### Reglas de archivos

- Formatos: PDF, JPEG, PNG. Máximo 10 MB.
- Se guardan en bucket **privado** (`verification-documents`), en `verifications/{requestId}/{documentId}.<ext>`. Nunca hay URL pública; el revisor las ve con URL firmada de 10 minutos.
- Solo se pueden borrar o reemplazar mientras la solicitud está en `DRAFT` o `NEEDS_CORRECTION`.
- Cada archivo guarda su `sha256`. Si el mismo archivo aparece en dos clínicas, el admin recibe una alerta.
- Solo el rol `OWNER` de la clínica sube o borra documentos.
- Los documentos de verificación no cuentan contra la cuota de almacenamiento del plan.

### Tipos de documento del backend

| Para | Tipos |
|---|---|
| Clínica | `RUT`, `CHAMBER_OF_COMMERCE`, `LEGAL_REP_ID`, `FACADE_PHOTO` (opcional) |
| Profesional | `PROFESSIONAL_CARD`, `ID_DOCUMENT`, `DEGREE` (opcional) |

---

## 4. Estados después de enviar

### Estado de la clínica

```
PENDING_DOCUMENTS ──enviar──▶ UNDER_REVIEW ──aprobar──▶ ACTIVE ──suspender──▶ SUSPENDED
        ▲                          │                       ▲                      │
        └──── NEEDS_CORRECTION ◀───┤ pedir corrección      └─────reactivar────────┘
                                   └──rechazar──▶ REJECTED
```

| Estado | Pantalla | Frame | Qué ve la clínica |
|---|---|---|---|
| `UNDER_REVIEW` | En revisión | `1911:109` | Línea de tiempo y "Mientras esperas puedes…" |
| `NEEDS_CORRECTION` | Corrige y reenvía | `1911:198` | Nota del revisor y el documento a corregir |
| `ACTIVE` | ¡Aprobada! | `1911:303` | Sello turquesa, "Clínica verificada" y la prueba PRO de 30 días |
| `REJECTED` | No aprobada | `1911:368` | Motivo, qué hacer, intentos restantes y aviso de borrado a los 90 días |
| `SUSPENDED` | Inicio: clínica suspendida | `2037:573` | Ve su información pero no puede operar |
| `PENDING_DOCUMENTS` / `UNDER_REVIEW` dentro del panel | Inicio: pendiente de aprobación | `2037:225` | Banner permanente y la lista "Configura tu clínica" |

### Qué puede hacer la clínica antes de ser aprobada

Puede: configurar perfil, logo, horarios, catálogo de servicios, invitar personal y gestionar su suscripción.
No puede: vincular dueños, registrar pacientes, recibir citas ni aparecer en el directorio.

### Qué NO ve la clínica

El reporte de la IA y el nivel de riesgo. Solo ve el estado y las notas del revisor.

---

## 5. Reglas de negocio

1. **Revisión híbrida:** la IA pre-analiza, una persona del equipo MyAnimaLog decide después de consultar el registro oficial de COMVEZCOL. La IA solo recomienda `READY_FOR_HUMAN_REVIEW` o `NEEDS_ATTENTION`; nunca aprueba ni rechaza. Si falla o tarda más de 60 s, la revisión humana sigue igual.
2. **Prueba de 30 días** del plan PRO: empieza al aprobarse, no al registrarse. Si no paga, baja a FREE.
3. **Reintentos:** después de un rechazo puede enviar una solicitud nueva con documentos nuevos, hasta **3 intentos**. Después, solo soporte.
4. **Anti-spam:** un usuario puede ser `OWNER` de máximo 3 clínicas en estado no final.
5. **Unicidad:** nombre, correo y NIT no pueden repetirse.
6. **Tarjeta profesional:** el número es único. Si el veterinario lo cambia, vuelve a `NOT_SUBMITTED`.
7. **Aprobar** exige que el admin marque `registryChecked = true` (confirmó en el portal oficial). Se guarda quién y cuándo.
8. **Escritura clínica** (`CLINICAL_WRITE`, `NURSING_WRITE`) solo con tarjeta profesional verificada (`vet_licensed = true`). El cambio llega en el siguiente refresh del token, máximo 15 minutos.
9. **Borrado:** los documentos de solicitudes rechazadas se borran a los 90 días.
10. **Privacidad:** los documentos no se guardan en el servicio de IA, no se usan para entrenar y no se escriben en logs.
11. **El sello de verificada** va en todos los planes y no se vende.

---

## 6. Datos en el backend

### Clínica (`veterinaries`)

| Columna | Origen en el registro |
|---|---|
| `name` | Nombre comercial |
| `legal_name` | Razón social |
| `nit` | NIT con DV |
| `phone` | Teléfono |
| email de la clínica | Correo de la clínica |
| `address`, `city`, `department` | Dirección, ciudad y departamento |
| `latitude`, `longitude` | Pin del mapa |
| `logo_url` | Logo |
| `status` | Empieza en `PENDING_DOCUMENTS` |
| `created_by` | Usuario que registra (sale del token, no del body) |
| `approved_at` | Se llena al aprobar |

Valores por defecto que el registro no pide, pero se pueden cambiar después en "Mi clínica": `timezone = America/Bogota`, `currency = COP`, `default_appointment_minutes = 30`, `allow_online_booking = true`, `booking_requires_confirmation = true`, `cancellation_min_hours = 4`, `directory_visible = true`.

### Perfil profesional (`professional_profiles`)

`user_id`, `full_name`, `document_type` (`CC`, `CE`, `PPT`), `document_number`, `license_number`, `profession` (`MV`, `MVZ`), `specialty`, `university`, `signature_url`, `license_status` (`NOT_SUBMITTED`, `PENDING`, `VERIFIED`, `REJECTED`), `rejection_reason`, `verified_at`, `verified_by`.

### Solicitud de verificación (`verification_requests`)

`subject_type` (`CLINIC` o `PROFESSIONAL`), `subject_id`, `status` (`DRAFT`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `APPROVED`, `REJECTED`), `submitted_by`, `submitted_at`, `ai_status`, `ai_report`, `ai_risk_level`, `reviewer_id`, `reviewer_notes`, `decided_at`, `registry_checked`.

### Documentos (`verification_documents`)

`request_id`, `document_type`, `storage_path`, `mime_type`, `file_size_bytes`, `sha256`, `uploaded_at`.

### Lo que hace `RegisterVeterinary` en una sola transacción

1. Crea la clínica en `PENDING_DOCUMENTS`.
2. Crea al creador como empleado `OWNER`.
3. Crea una `verification_request` en `DRAFT`.
4. Publica el evento `VETERINARY_REGISTERED`.

---

## 7. Endpoints

La guía del 13 oct indica que hoy el registro **solo recibe los datos de la clínica**. Documentos y perfil profesional todavía no están desplegados.

| Qué | Ruta real hoy (guía) | Ruta objetivo (maestro) | Estado |
|---|---|---|---|
| Registrar clínica | `POST /api/veterinary/register` | `POST /veterinaries` | Existe, sin desplegar |
| Mis clínicas | `GET /api/veterinary/me` | `GET /me/veterinaries` | Existe, sin desplegar |
| Ver verificación | — | `GET /veterinaries/{id}/verification` | Plan |
| Subir documento | — | `POST /veterinaries/{id}/verification/documents` (multipart `documentType`, `file`) | Plan |
| Borrar documento | — | `DELETE /veterinaries/{id}/verification/documents/{docId}` | Plan |
| Enviar a verificación | — | `POST /veterinaries/{id}/verification/submit` | Plan |
| Perfil profesional | — | `GET` / `PUT /me/professional-profile` | Plan |
| Documentos del perfil | — | `POST /me/professional-profile/documents` | Plan |
| Firma | — | `PUT /me/professional-profile/signature` | Plan |
| Enviar perfil profesional | — | `POST /me/professional-profile/submit` | Plan |
| Logo | — | `PUT` / `DELETE /veterinaries/{id}/logo` | Plan |
| Entrar a la clínica | `POST /api/auth/context/veterinary/{id}` | igual | Existe |
| Banner de estado | claim `vet_status` del token de clínica | igual | Existe |

**Lado del equipo MyAnimaLog** (no es el registro, pero lo cierra): `GET /admin/verifications`, `GET /admin/verifications/{id}`, `POST …/approve` (`registryChecked: true`), `POST …/reject` (`reason`), `POST …/request-correction` (`notes`, `documentTypes[]`), `POST …/rerun-ai`. Pantallas: `2040:300` y `2040:753`.

---

## 8. Medidas del diseño

Pantallas de escritorio de **1280 × 832**. El formulario vive en la columna blanca de la izquierda; la columna de marca (degradado, logo, gato, manchas) es igual en todas.

| Elemento | Medida |
|---|---|
| Eje central | x = 236 |
| Columnas | izquierda x = 45, derecha x = 242, de 184 px cada una (13 px entre ellas) |
| Ancho completo | 381 px (x = 45 a x = 426) |
| Indicador de paso | texto en y = 34, barra de 381 × 4 en y = 56 |
| Título | y = 98 |
| Subtítulo | y = 172, ancho 320 |
| Contenido | empieza en y ≈ 232–244 |
| Botones Atrás / Continuar | y = 700, uno en cada columna |
| Campo | etiqueta + caja de 41 px de alto, borde negro 2 px, radio 5 |

Tipografía: Afacad Bold 64 para títulos (baja a 40 si no caben en 410 px), Bold 16 etiquetas, Bold 15 botones, Medium 15 subtítulos (`#404040`), Medium 12–13 ayudas, Bold 12 en mayúsculas para "PASO N DE 6" (`#4037BE`).

Componentes (frame `1908:2`): `Vet/Campo` (`1908:3`), `Vet/Botón` (`1908:13`), `Vet/Documento` (`1908:48`).

Colores: morado `#4037BE`, turquesa neón `#00FFDF` **solo** en el sello de "¡Aprobada!", turquesa clínico `#00796B` y suave `#E0FFFA` para chips "Listo", naranja `#F5A623` para "Corregir", rojo solo para acciones destructivas.

Microcopy: español, segunda persona ("Sube…", "Revisa…"). Etiqueta arriba del campo; el placeholder solo da un ejemplo.

---

## 9. Brechas del registro

1. **El panel no existe en código.** No hay repo ni proyecto; el registro solo está diseñado.
2. **El backend solo registra la clínica** (guía 13 oct). Subir documentos, enviar a verificación y el perfil profesional no están desplegados. Hasta entonces, los pasos 3 a 6 quedarían con datos de prueba.
3. **El Register "va a cambiar"** (nota de CONTEXTO, 5 oct): confirmar con el equipo qué cambia antes de programar.
4. **Falta el campo "Representante legal" en el backend de la guía:** la clínica guarda `legal_name` y NIT, pero el nombre y documento del representante solo viajan a la IA (`legalRepName`, `legalRepDocument`). Confirmar dónde se guardan.
5. **Rutas distintas** entre el maestro y la guía (`/veterinaries` frente a `/api/veterinary`). Confirmar en Swagger (`http://localhost:8082/swagger-ui.html`).
6. **Prerrequisito:** el correo debe estar verificado antes de registrar.
7. **Datos de ejemplo del diseño** ("Clínica Patitas", "Ana María Gómez", el NIT) son inventados.
