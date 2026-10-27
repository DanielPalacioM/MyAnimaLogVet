# Administración de la plataforma · revisión de documentos

> Cómo funciona la parte donde el **equipo de MyAnimaLog revisa los documentos** de clínicas y veterinarios, de principio a fin: lo que envía el usuario, lo que analiza la IA, lo que ve y decide el administrador, y qué cambia después.
> Fuentes: frames de Figma `e9FbM805Y2oAmOgIbcL0Hj`, `MYANIMALOG_VET_REGISTRO.md`, `MYANIMALOG_VET_MAESTRO.md` (§4, §5.3–5.4, §13 IA-01).
> **Nota:** el anterior `FIGMA_VISTAS_119_A_128.md` describe la app móvil del dueño (frames 119–128 por posición en la página). Este documento cubre la **administración**; si querías otros frames, dime los nombres y lo ajusto.

## Resumen en una frase

La clínica (o el veterinario) sube sus documentos → una **IA los pre-analiza** y entrega un reporte de apoyo → una **persona del equipo** los abre, confirma en el **registro oficial** (RUES / COMVEZCOL) y **decide**: aprobar, pedir corrección o rechazar. La IA **nunca decide**.

## 1. Pantallas que cubre

| Pantalla | Frame | Estado |
|---|---|---|
| Admin · Revisión de verificaciones (clínica) | `2040:300` | Diseño original |
| Admin · Clínicas: suspender y reactivar | `2040:753` | Diseño original |
| Admin · Revisión de **profesional** | `2191:300` | Propuesta (nueva) |
| Admin · Pedir corrección (diálogo) | `2192:300` | Propuesta (nueva) |
| Admin · Rechazar (diálogo) | `2192:483` | Propuesta (nueva) |
| Admin · Visor de documento | `2192:666` | Propuesta (nueva) |
| Correos: corrección / no aprobada / verificada | `2196:500`, `2196:524`, `2196:548` | Propuesta (nueva) |
| Perfil profesional: corrección desde el correo | `2196:300` | Propuesta (nueva) |
| Lo que ve la clínica: pasos 4–6 y estados | `1910:20`, `1910:131`, `1910:244`, `1911:109`, `1911:198`, `1911:303`, `1911:368` | Diseño original |
| Perfil profesional del veterinario | `2039:267` | Diseño original |

Lo marcado como **propuesta** lo diseñé yo en esta sesión para completar el flujo del veterinario; no estaba en el Figma original.

## 2. El flujo completo

```
 USUARIO                          SISTEMA                         EQUIPO MyAnimaLog (PLATFORM_ADMIN)
 ───────                          ───────                         ─────────────────────────────────
 Paso 4: sube RUT, Cámara,
 cédula (+ fachada)
 Paso 5: tarjeta profesional,
 cédula (+ título)
 Paso 6: "Enviar a verificación"
                                  Clínica → UNDER_REVIEW
                                  IA analiza en segundo plano
                                  (hasta 60 s; si falla, sigue
                                   la revisión humana)
                                                                  Abre la solicitud, ve datos,
                                                                  documentos (enlace de 10 min)
                                                                  y reporte de la IA
                                                                  Consulta RUES / COMVEZCOL
                                                                  Marca "confirmé en el registro"
                                                                  Decide ──┬─ Aprobar
                                                                           ├─ Pedir corrección (nota + documentos)
                                                                           └─ Rechazar (motivo)
 ◀──────────── correo + estado en pantalla ───────────────────────────────┘
```

- **Quién se verifica:** la **clínica** (documentos legales) y cada **veterinario** (su tarjeta profesional, que es de la persona y se verifica una sola vez aunque trabaje en varias clínicas).
- **Tiempo prometido:** "Respondemos en 24 a 48 horas" (paso 6); en el perfil del veterinario, "en 1 a 2 días hábiles".
- **Mientras esperan:** la clínica puede configurar horarios, catálogo e invitar equipo, pero **no recibe pacientes ni aparece en el directorio**. El veterinario puede ver agenda e historia y aplicar vacunas/registrar peso (según el diseño), pero no escribir consultas.

## 3. Lo que envía el usuario

### Clínica (tipo `CLINIC`)
| Documento | Tipo | Obligatorio | Nota del diseño |
|---|---|:-:|---|
| RUT | `RUT` | Sí | "PDF de la DIAN con la actividad veterinaria" |
| Cámara de Comercio | `CHAMBER_OF_COMMERCE` | Sí | "Expedido hace menos de 30 días" |
| Cédula del representante legal | `LEGAL_REP_ID` | Sí | "Ambas caras, legible y sin recortes" |
| Foto de la fachada | `FACADE_PHOTO` | No | "Ayuda a que la revisión sea más rápida" |

### Profesional (tipo `PROFESSIONAL`)
| Documento | Tipo | Obligatorio |
|---|---|:-:|
| Tarjeta profesional (ambas caras) | `PROFESSIONAL_CARD` | Sí |
| Cédula | `ID_DOCUMENT` | Sí |
| Título / diploma | `DEGREE` | No |
| Firma en PNG | (aparte, bucket privado) | Se sube después, para fórmulas y certificados |

Datos del profesional: profesión (`MV` o `MVZ`), número de tarjeta (único en la plataforma), especialidad y universidad (opcionales).

### Reglas de los archivos
- PDF, JPEG o PNG, **máximo 10 MB**. Cada documento tiene tres estados: **Pendiente** (botón Subir), **Listo** (chip turquesa) y **Corregir** (borde y fondo ámbar, "Volver a subir").
- Se guardan en un bucket **privado** (`verification-documents`); **nunca hay URL pública**: el revisor ve cada archivo con un **enlace firmado de 10 minutos**.
- Solo se pueden borrar o reemplazar en estado `DRAFT` o `NEEDS_CORRECTION`, y solo el rol `OWNER` de la clínica.
- Cada archivo guarda su **huella `sha256`**: si el mismo archivo aparece en **dos clínicas distintas**, el administrador recibe una **alerta**.
- No cuentan contra la cuota de almacenamiento del plan.

## 4. Qué hace la IA

**Principio no negociable:** la IA **asiste**, no decide. Solo puede recomendar `READY_FOR_HUMAN_REVIEW` o `NEEDS_ATTENTION`; no existe "aprobar" ni "rechazar". Su reporte se guarda en la solicitud y **la clínica nunca lo ve**, ni el nivel de riesgo.

**Cuándo corre:** al enviar a verificación, en segundo plano (no bloquea la respuesta). Si falla o tarda más de 60 s, el estado queda `FAILED` y **la revisión humana sigue igual**, sin reporte. El administrador puede **"Volver a analizar"**.

**Qué comprueba** (nivel de riesgo: **bajo** todo consistente · **medio** advertencias menores o certificado viejo · **alto** datos que no coinciden, tipo equivocado o señales de edición):

| Check | Qué valida |
|---|---|
| Tipo del documento | Que lo subido sea del tipo declarado (no una foto cualquiera como "RUT") |
| Legibilidad | Texto legible, documento completo |
| NIT | NIT del RUT = NIT declarado (con dígito de verificación) |
| Razón social | Igual en RUT y Cámara de Comercio |
| Representante legal | Certificado = nombre y número de la cédula |
| Certificado reciente | Expedición reciente (umbral configurable, ej. 30–90 días) |
| Actividad del RUT | Relacionada con actividades veterinarias (código 7500) |
| Nombre del profesional | Tarjeta = cédula |
| Número de tarjeta | Igual al declarado |
| Señales de edición | Solo genera advertencia, nunca una conclusión |

**Privacidad:** no se loguea el contenido, no se usa para entrenar ni se guarda en el servicio de IA (se procesa en memoria). El aviso de tratamiento de datos (Ley 1581) lo dice.

**Por qué no solo IA:** puede leer un documento editado y extraer datos coherentes, pero no sabe si la tarjeta es real; eso solo lo confirma el registro oficial de COMVEZCOL. **Por qué no solo manual:** a mano se escapan inconsistencias que la IA detecta en segundos.

## 5. Pantalla "Revisión de verificaciones" (`2040:300`)

Pantalla de escritorio 1280 × 832, con **menú lateral propio del equipo**: Verificaciones · Clínicas (con insignia) · Profesionales. Abajo, el usuario ("Equipo MyAnimaLog · Admin de plataforma"). Etiqueta superior: **"Solo equipo MyAnimaLog"**.

### Columna izquierda · cola de solicitudes
- **Filtros:** *En revisión 3* (activo) · *Corrección pedida 1* · *Aprobadas* · *Rechazadas*.
- **Cada solicitud:** nombre, tipo (**Clínica** o **Profesional · MV/MVZ**), fecha de envío y un chip con el **riesgo de la IA**: *IA: riesgo bajo* (verde) · *IA: riesgo alto* (rojo) · *IA: no corrió* (gris). La seleccionada lleva borde izquierdo morado.
- Ejemplos del diseño: Clínica Patitas Norte (bajo), Julián Rojas (bajo), Mascotas Felices SAS (**alto**), Laura Medina (no corrió).

### Columna derecha · detalle
1. **Encabezado:** nombre y estado (*En revisión*).
2. **Datos declarados** (en dos columnas): NIT, razón social, ciudad, representante (nombre y cédula), **dueña de la cuenta** (correo *verificado*) e **intento** (*1 de 3*).
3. **Documentos:** una fila por archivo (nombre, tamaño, antigüedad, p. ej. *"expedido hace 12 días"*) con el botón **"Ver (enlace de 10 min)"**.
4. **Reporte de la IA · solo apoyo** (recuadro suave): chip de riesgo, enlace **Volver a analizar** y lista de verificaciones ✓ (documentos legibles, NIT coincide, representante coincide, actividad del RUT 7500, ningún archivo repetido en otra clínica). Pie: *"La clínica nunca ve este reporte ni el nivel de riesgo."*
5. **Casilla obligatoria (caja ámbar):** *"Confirmé los datos en el registro oficial (RUES para la clínica; COMVEZCOL para las tarjetas profesionales). Obligatorio para aprobar."*
6. **Decisión:**
   - **Rechazar** (rojo, borde) · **Pedir corrección** (negro, borde) · **Aprobar e iniciar prueba PRO** (morado, **deshabilitado hasta marcar la casilla**).
   - Pie: *"Rechazar y pedir corrección piden un motivo, que la clínica sí ve. Al aprobar queda guardado quién aprobó y cuándo."*

### Cómo se usa (paso a paso)
1. Entrar por la cola y elegir una solicitud (las de **riesgo alto** conviene abrirlas primero).
2. Leer los datos declarados y abrir **cada documento** (enlace de 10 minutos; si vence, se vuelve a pedir).
3. Cruzar con el reporte de la IA **y con el portal oficial** (RUES para clínicas, COMVEZCOL para tarjetas). No hay consulta automática a COMVEZCOL.
4. Marcar la casilla de confirmación (solo si realmente se verificó).
5. Decidir. Aprobar exige la casilla; rechazar y corregir exigen un motivo.

## 6. Pantalla "Clínicas: suspender y reactivar" (`2040:753`)

- **Buscador:** *"Buscar por nombre, NIT o ciudad"*.
- **Tabla:** Clínica · Ciudad · **Estado** (Activa / Suspendida / En revisión) · **Plan** (PRO, BASIC, FREE, —) · Aprobada (fecha) · **Acciones**: **Suspender** (rojo) en activas, **Reactivar** en suspendidas, **Revisar** en las que están en revisión (lleva a la cola).
- **Reglas** (nota al pie): *Suspender pide un motivo y avisa al dueño por correo. Mientras está suspendida, la clínica ve su información pero no puede agendar, registrar pacientes ni escribir en historias. Reactivar también aprueba clínicas nuevas mientras no exista la revisión de documentos.*
- **Efecto en el panel de la clínica:** aparece el banner "clínica suspendida" (`2037:573`).

## 7. Propuesta: revisión de un profesional (`2191:300` y diálogos)

Misma pantalla que la de clínica, con estos cambios:
- **Datos:** profesión, número de tarjeta, documento, universidad, especialidad, **dónde trabaja** (clínicas) e intento.
- **Documentos:** tarjeta profesional, cédula y diploma (opcional).
- **IA:** tarjeta legible, número coincide con el formulario, nombre coincide con la cédula, diploma, tarjeta no usada en otro registro.
- **Casilla:** *"Confirmé la tarjeta en el registro oficial de COMVEZCOL (número, nombre y vigencia)."* → botón **"Aprobar y verificar tarjeta"**.
- **Pedir corrección (`2192:300`):** elegir **qué documentos** corregir (tarjeta, cédula, diploma) y escribir una **nota obligatoria** (con contador de caracteres). Queda en "Corrección pedida".
- **Rechazar (`2192:483`):** elegir un **motivo** (no aparece en COMVEZCOL · datos no coinciden · documento ilegible/alterado/vencido · otro) y una **nota obligatoria**. Avisa: *"le quedarían 2 de 3 intentos"* y *"los documentos se borran a los 90 días"*. Botón rojo.
- **Visor de documento (`2192:666`):** abre el archivo **dentro de la pantalla**: pestañas cara frontal/reverso, zoom, y a la derecha **"Datos a comparar"** (nombre, número, profesión, fecha de expedición) con marca de coincidencia (*✓ Coincide con la cédula / con el formulario*), aviso de **enlace seguro (vence en 9:41)**, navegación entre documentos (*Anterior / Siguiente: Cédula*) y el recordatorio de que nada se guarda en la IA.

## 8. Qué pasa con cada decisión

| Decisión | Estado de la clínica / profesional | Qué ve el usuario | Consecuencias |
|---|---|---|---|
| **Aprobar** | Clínica → `ACTIVE`. Profesional → `license_status = VERIFIED` | Clínica: pantalla **¡Aprobada!** (sello turquesa "Clínica verificada") · Profesional: correo "tarjeta verificada" | Empieza la **prueba PRO de 30 días** (al aprobar, no al registrarse); puede recibir pacientes, citas y aparecer en el directorio. El veterinario obtiene **escritura clínica** en el **siguiente refresh del token (máx. 15 min)**. Se guarda quién aprobó y cuándo |
| **Pedir corrección** | `NEEDS_CORRECTION` | **Corrige y reenvía**: *Nota del revisor* + el documento a corregir marcado (*Volver a subir*); los demás aparecen "Revisado". En la propuesta, llega **por correo** con enlace directo al documento (7 días) | Solo puede reemplazar los documentos marcados; al reenviar vuelve a `UNDER_REVIEW` |
| **Rechazar** | `REJECTED` | **No aprobada**: motivo, "qué puedes hacer", intentos restantes (*"Te quedan 2 de 3 intentos"*), soporte | Puede enviar una **solicitud nueva con documentos nuevos**, **máximo 3 intentos** (después, solo soporte). Los documentos se **borran a los 90 días** |

Línea de estados de la clínica:

```
PENDING_DOCUMENTS ──enviar──▶ UNDER_REVIEW ──aprobar──▶ ACTIVE ──suspender──▶ SUSPENDED
        ▲                          │                       ▲                      │
        └──── NEEDS_CORRECTION ◀───┤ pedir corrección      └─────reactivar────────┘
                                   └──rechazar──▶ REJECTED
```

## 9. Seguridad y trazabilidad

- **Rol `PLATFORM_ADMIN`:** solo el equipo de MyAnimaLog; **no hay forma de auto-asignárselo** (se marca por script). Todas las rutas `/admin/**` lo exigen.
- **Quién aprobó y cuándo** (y `registryChecked = true`) se guarda siempre. Aprobar sin confirmar en el registro oficial es inválido.
- **Aislamiento:** los documentos solo los ve el equipo de verificación (enlace de 10 minutos, bucket privado); nadie más, ni la propia clínica una vez enviados.
- **Alertas al revisor:** archivo repetido en otra clínica (`sha256`), riesgo alto, certificado viejo, señales de edición.
- **Límites anti-spam:** un usuario puede ser `OWNER` de máximo 3 clínicas en estado no final; nombre, correo y NIT no se repiten.

## 10. Backend (contratos)

| Ruta | Para qué |
|---|---|
| `GET /admin/verifications?status=&subjectType=` | La cola (filtros de la pantalla) |
| `GET /admin/verifications/{id}` | Detalle: datos, **URLs firmadas** de 10 min y `ai_report` |
| `POST …/rerun-ai` | "Volver a analizar" |
| `POST …/approve` | Aprobar (`registryChecked: true` obligatorio) |
| `POST …/reject` | Rechazar (`reason` obligatorio) |
| `POST …/request-correction` | Pedir corrección (`notes`, `documentTypes[]`) |
| `PATCH /admin/veterinaries/{id}/suspend` · `/reactivate` | Pantalla de Clínicas |
| `POST /veterinaries/{id}/verification/documents` · `…/submit` | Lado de la clínica |
| `PUT /me/professional-profile` · `…/submit` | Lado del veterinario |

Tablas: `verification_requests` (sujeto, estado, `ai_status`, `ai_report`, `ai_risk_level`, revisor, notas, `registry_checked`), `verification_documents` (tipo, ruta, tamaño, `sha256`), `professional_profiles` (`license_status`: `NOT_SUBMITTED`, `PENDING`, `VERIFIED`, `REJECTED`).

## 11. Brechas y puntos a confirmar

1. **El panel de administración no está programado** (solo diseño). Tareas pendientes: `VET-17` (cola, detalle, aprobar/rechazar/corregir).
2. **Pantalla "Profesionales" del menú:** existe el ítem pero no su frame; falta definir qué lista (veterinarios verificados, suspender licencia, etc.).
3. **El diseño original solo cubre la revisión de clínicas.** La de profesionales, los diálogos de motivo/corrección y el visor son propuestas mías: hay que validarlas con el equipo.
4. **Correo como canal único** de las respuestas: el diseño original muestra pantallas de estado; las propuestas añaden correo + enlace directo. Decidir si conviven.
5. **Mensaje del botón de aprobar** ("iniciar prueba PRO") solo aplica a clínicas; para profesionales se propuso "Aprobar y verificar tarjeta".
6. **Promesa de tiempo distinta:** 24–48 h (clínica) y 1–2 días hábiles (veterinario).
7. **"Reactivar también aprueba clínicas nuevas mientras no exista la revisión de documentos"** (nota de la pantalla Clínicas): es un atajo temporal; debe quitarse cuando la revisión funcione.
8. **Documentos del dueño del backend:** el backend de hoy solo recibe los datos de la clínica; subir documentos, enviar a verificación y el perfil profesional **todavía no están desplegados**.
9. **No se automatiza COMVEZCOL** (sin API pública); la confirmación seguirá siendo manual.
10. **Datos de ejemplo inconsistentes** entre frames (NIT, números de tarjeta, nombres): son de relleno.
