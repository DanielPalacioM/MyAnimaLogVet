# Datos de la mascota que faltan: esterilización, alergias y ciclo de desparasitación

> Propuesta para el equipo de backend y para los dos frontends: la **app del dueño (MyAnimaLog, móvil)** y el **panel de la clínica (MyAnimaLogVet, web)**.
> Alcance: **tres datos y nada más**. Cada uno se explica con su razón, quién lo escribe, dónde se guarda y qué hace cada ecosistema.
> Fecha: 17 de noviembre de 2026. Los datos del backend se verificaron ese día contra el gateway real.

## Índice

1. Por qué estos tres datos
2. Punto de partida: qué existe hoy
3. Reglas comunes a los tres
4. Esterilización
5. Alergias
6. Ciclo de desparasitación
7. Contrato propuesto para el backend
8. Trabajo por ecosistema
9. Orden de entrega y criterios de aceptación
10. Decisiones abiertas

---

## 1. Por qué estos tres datos

Una clínica que recibe una mascota que no conoce necesita, antes de tocarla, responder tres preguntas:

| Pregunta de la clínica | Dato | Por qué importa |
|---|---|---|
| ¿Puedo darle este medicamento o anestesiarla sin riesgo? | **Alergias** | Es el dato de **seguridad**. Una alergia no registrada puede causar una reacción grave. |
| ¿Cómo se maneja su cuerpo y su reproducción? | **Esterilización** | Cambia el riesgo quirúrgico, las enfermedades que hay que sospechar y la dosis y la dieta. |
| ¿Está protegida contra parásitos? | **Ciclo de desparasitación** | Es la prevención que más se repite en la vida de la mascota y la que más se olvida. |

Hoy los tres faltan, y el diseño del panel ya los espera (chip "Esterilizado", alerta ámbar de alergia, bloque de prevención en el Resumen). Si el dueño no los registra en la app y la clínica no los ve en el panel, cada clínica nueva empieza de cero y le pregunta al dueño de memoria.

**Idea central del producto:** la historia es del dueño y viaja con la mascota entre clínicas. Por eso el dueño tiene que poder registrar estos datos desde la app, y la clínica tiene que poder completarlos y confirmarlos desde el panel. Los dos ven la misma información.

---

## 2. Punto de partida: qué existe hoy

Verificado el 17 de nov de 2026 contra el gateway real.

| Parte | Qué tiene | Qué le falta |
|---|---|---|
| **Backend de mascotas** | `id, ownerId, name, species, breed, sex, birthDate, height, weight, photoUrl, createdAt` | Esterilización, alergias. No devuelve `vaccine` ni `vetName`, aunque la app los envía al crear. |
| **Medical** | Visitas, vacunas, peso, tratamientos, medicaciones (una medicación se puede marcar `REACCION` con nota), cirugías, laboratorios | Alergias y desparasitación. La ruta `GET /pets/{id}/clinical-summary` responde **404** en el gateway. |
| **App del dueño** | Registro de mascota en 3 pasos (Foto, Info básica, Médico), perfil con estadísticas, tarjeta de vacunas con línea de vida | `DEWORMING` y `ALLERGY_REPORT` existen solo como **categorías de documentos** (archivos subidos), no como datos. |
| **Panel Vet** | Cabecera de historia con chips de alergia (espera `allergies: string[]` del resumen), pestañas de historia, diálogo para registrar visita, vacuna y peso | No hay formulario para alergias ni desparasitación. Los chips nunca se llenan porque el resumen da 404. |

---

## 3. Reglas comunes a los tres

Aplican a esterilización, alergias y desparasitación.

1. **Todo registro lleva origen, autor y fecha.** Origen: `OWNER` (lo escribió el dueño) o `CLINIC` (lo escribió una clínica, con su `veterinaryId` y el empleado). Así se sabe en quién confiar y de dónde viene.
2. **Nada se borra en silencio.** Un error se corrige marcando el registro como "ingresado por error" o "resuelto", con motivo. La historia clínica es un documento con valor: se conserva quién cambió qué.
3. **Lo que el dueño escribe vale como declarado; lo que confirma un veterinario vale como verificado.** La app y el panel muestran esa diferencia ("Declarado por el dueño" frente a "Confirmado por Dra. Ruiz").
4. **"No sé" no es "no tiene".** Para esterilización y alergias hay un estado `UNKNOWN` distinto de "no". Una mascota adoptada puede no tener historial, y tratar la falta de dato como "sin alergias" es peligroso.
5. **Permisos del dueño en la app:** `OWNER` y `EDITOR` de la mascota registran y editan; `VIEWER` solo lee. Los demás datos de la mascota siguen la misma regla (`canEdit = role !== 'VIEWER'`).
6. **Permisos de la clínica:** leer alergias y esterilización requiere `CLINICAL_READ_BASIC` (todos los roles, incluida recepción). Escribir alergias confirmadas requiere `CLINICAL_WRITE` (veterinario con tarjeta verificada). Registrar una desparasitación requiere `NURSING_WRITE` (igual que aplicar una vacuna).
7. **Solo ve la clínica a la que el dueño le compartió la mascota** y mientras el acceso esté activo. Si el dueño revoca, la clínica deja de verlos; lo que ya registró no se borra.
8. **Fechas:** ISO-8601; en pantalla `toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })`.

---

## 4. Esterilización

### 4.1 Por qué se agrega

- **Riesgo anestésico y quirúrgico.** Antes de operar, la clínica necesita saber si la mascota ya fue intervenida. Evita repetir una cirugía, y quien operó antes deja una cicatriz que confunde si no está anotado.
- **Enfermedades que hay que sospechar.** Una hembra sin esterilizar puede tener piómetra (infección de útero) o tumores mamarios; un macho entero, problemas de próstata. Si ya está esterilizada, esas hipótesis bajan. La clínica llega al diagnóstico más rápido.
- **Medicación y dieta.** Las mascotas esterilizadas tienden a subir de peso y suelen necesitar otra ración. Algunos tratamientos y dosis cambian según el estado reproductivo.
- **Comportamiento.** Marcaje, celo, agresividad entre machos y fugas se explican distinto según el estado.
- **Hoy es un dato que "se intuye".** Una cirugía llamada "Orquiectomía (esterilización)" existe en Medical solo como texto libre; no se puede consultar ni filtrar.

### 4.2 Qué se guarda

En el **perfil de la mascota** (servicio de mascotas), porque es un atributo de la mascota que dueño y clínica pueden editar:

| Campo | Tipo | Detalle |
|---|---|---|
| `neuteredStatus` | `YES` / `NO` / `UNKNOWN` | `UNKNOWN` por defecto. Nunca nulo. |
| `neuteredAt` | fecha, opcional | Solo si `YES`. Puede ser aproximada (mes y año). |
| `neuteredSource` | `OWNER` / `CLINIC` | Quién lo declaró. |
| `neuteredConfirmedBy` | empleado o `null` | Lo llena la clínica cuando lo verifica (por una cirugía registrada o un examen). |

Validaciones: `neuteredAt` no puede ser futura ni anterior al nacimiento; no se acepta `neuteredAt` si el estado no es `YES`.

### 4.3 Cómo se alimenta

1. **El dueño lo declara al registrar o editar la mascota** (móvil).
2. **La clínica lo confirma o corrige** desde la ficha del paciente (panel).
3. **Sugerencia automática:** cuando una clínica registra una cirugía de esterilización, el panel ofrece "Marcar como esterilizada" con la fecha de la cirugía. No se cambia solo: lo confirma una persona.

### 4.4 App móvil del dueño

- **Registrar mascota, paso 2 "Info básica":** selector "¿Está esterilizada?" con tres opciones (Sí, No, No sé). Si responde Sí, aparece "¿Cuándo? (opcional)". Texto de ayuda: "Ayuda a la clínica a cuidarla mejor en una cirugía o un tratamiento."
- **Editar mascota:** el mismo campo.
- **Perfil de la mascota:** se suma a la tarjeta de datos (junto a edad, peso, sexo y altura) como "Esterilizada: Sí · desde mar 2024" o "Sin confirmar".
- **Si lo confirma una clínica:** se ve la etiqueta "Confirmado por [Clínica]".

### 4.5 Panel de la clínica

- **Cabecera de la historia y ficha del paciente:** chip "Esterilizado" (con la fecha si existe). Si es `UNKNOWN`, chip gris "Esterilización sin confirmar".
- **Edición:** un veterinario o auxiliar puede cambiarlo desde la ficha ("Confirmar esterilización"), y queda el autor.
- **Al registrar una cirugía** cuyo título indique esterilización, aparece la sugerencia de actualizar el dato.

### 4.6 Criterios de aceptación

- El dueño la registra y la clínica con acceso la ve en la ficha, sin refrescar a mano.
- Una clínica confirma el dato y el dueño ve "Confirmado por …".
- Con `UNKNOWN` ninguna pantalla afirma que está o no esterilizada.
- Una clínica sin acceso a la mascota no puede leerlo.

---

## 5. Alergias

### 5.1 Por qué se agrega

- **Es el dato de seguridad más importante.** Una mascota alérgica a la penicilina que recibe amoxicilina puede sufrir una reacción grave o mortal. Conocer la alergia **antes** de recetar evita el daño.
- **Viaja entre clínicas.** Hoy cada clínica pregunta al dueño y depende de su memoria. Con el dato en la historia compartida, la alergia que detectó una clínica la ve la siguiente.
- **Lo ve todo el personal, incluida recepción.** Es información básica de seguridad, no un diagnóstico: por eso se lee con `CLINICAL_READ_BASIC`.
- **Ya está diseñado.** El panel muestra una alerta ámbar siempre visible arriba de la ficha, una caja "Antes de recetar" y un bloque "Ten en cuenta" al registrar una visita. Sin el dato esas pantallas quedan vacías.
- **Hay un origen natural.** Medical ya permite marcar una medicación como `REACCION` con una nota. Esa reacción es una alergia o intolerancia en potencia y puede proponerse como alergia con un clic.

### 5.2 Qué se guarda

En **Medical** (dato clínico con autor y fecha), porque lo escriben dueño y clínica y necesita historia de cambios.

Estado general de la mascota (para distinguir "no sé" de "no tiene"):

| Campo | Valores |
|---|---|
| `allergyStatus` | `UNKNOWN` (por defecto) · `NONE_KNOWN` (el dueño o la clínica indica que no se conocen alergias) · `HAS_ALLERGIES` (hay al menos un registro activo) |

Cada alergia:

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | uuid | |
| `petId` | uuid | |
| `allergen` | texto obligatorio | "Penicilina", "Pollo", "Picadura de pulga" |
| `category` | `DRUG` / `FOOD` / `ENVIRONMENT` / `OTHER` | Medicamento, alimento, ambiente u otro. |
| `reaction` | texto | "Urticaria", "Vómito", "Dificultad para respirar" |
| `severity` | `MILD` / `MODERATE` / `SEVERE` | Leve, moderada o grave. Define el color de la alerta. |
| `status` | `SUSPECTED` / `CONFIRMED` / `RESOLVED` / `ENTERED_IN_ERROR` | Sospechada, confirmada, resuelta o ingresada por error. |
| `source` | `OWNER` / `CLINIC` | |
| `recordedBy` | usuario o empleado | Autor. |
| `veterinaryId` | uuid o `null` | Clínica de origen, si la registró una clínica. |
| `recordedAt` | fecha | |
| `confirmedBy` / `confirmedAt` | empleado y fecha, o `null` | Quién la confirmó. |
| `notes` | texto, opcional | |

### 5.3 Flujo

1. **El dueño la registra desde la app** como `SUSPECTED` (declarada).
2. **La clínica la ve de inmediato** como alerta con la etiqueta "Declarada por el dueño".
3. **Un veterinario con tarjeta verificada la confirma** (`CONFIRMED`) o la corrige. Un auxiliar no puede confirmar, pero sí leerla.
4. **Una clínica puede registrar una alergia nueva** directamente como `CONFIRMED`.
5. **Si cambia** (la mascota superó la alergia o se registró por error), se pasa a `RESOLVED` o `ENTERED_IN_ERROR` con motivo. No se borra.
6. **Notificaciones:** cuando una clínica confirma o agrega una alergia, el dueño recibe aviso. Cuando el dueño registra una alergia grave, las clínicas con acceso la ven en la ficha en menos de un minuto.

### 5.4 App móvil del dueño

- **Registrar mascota, paso 3 "Médico":** pregunta "¿Tiene alergias conocidas?" con Sí, No y No sé. Si responde Sí, se abre "Agregar alergia" (alérgeno, tipo, reacción, gravedad). Si responde No, se guarda `NONE_KNOWN`.
- **Perfil de la mascota:** tarjeta **"Alergias y alertas"** con la lista, la gravedad en color y la etiqueta de origen. Botón "Agregar alergia" para `OWNER` y `EDITOR`. Con alergia grave activa, un aviso rojo y visible arriba.
- **Ver quién la confirmó:** cada alergia muestra "Declarada por ti" o "Confirmada por Dra. Ruiz · Clínica Patitas".
- **Menú del perfil:** entrada directa a "Alergias".

### 5.5 Panel de la clínica

- **Cabecera de la historia y ficha del paciente:** alerta ámbar siempre visible con el alérgeno y la gravedad ("Alérgico a la penicilina"). Con `allergyStatus = UNKNOWN`, chip "Alergias sin preguntar".
- **Pestaña Resumen:** bloque "Alertas" con el detalle, la reacción y de qué clínica viene.
- **Registrar visita:** caja "Ten en cuenta" con las alergias activas. Antes de agregar una medicación, aviso si el principio activo coincide con una alergia registrada.
- **Formulario "Registrar alergia"** para veterinarios con tarjeta (`CLINICAL_WRITE`). Para auxiliares y recepción, solo lectura.
- **Desde una medicación con reacción:** botón "Registrar como alergia".

### 5.6 Criterios de aceptación

- El dueño registra una alergia y la clínica con acceso la ve como alerta, con "Declarada por el dueño".
- Un veterinario con tarjeta la confirma y el dueño lo ve; un auxiliar no puede confirmar.
- Con `UNKNOWN` ninguna pantalla dice "sin alergias".
- La recepción ve la alerta; no ve diagnósticos.
- Una alergia retirada no desaparece: queda como `RESOLVED` o `ENTERED_IN_ERROR` con autor.
- `GET /pets/{id}/clinical-summary` responde 200 y trae las alergias.

---

## 6. Ciclo de desparasitación

### 6.1 Por qué se agrega

- **Es la prevención más repetida y la más olvidada.** A diferencia de la vacuna anual, los antiparasitarios se repiten cada pocas semanas o meses, y el dueño pierde la cuenta.
- **El esquema cambia con la edad.** Cachorros y gatitos se desparasitan con mucha más frecuencia que un adulto. Sin un ciclo, la app no puede decir "toca esta semana".
- **Protege también a las personas.** Varios parásitos intestinales pasan de la mascota a los niños (zoonosis). Es un argumento de salud pública además de salud animal.
- **La dosis depende del peso.** Anotar el peso del día de la aplicación evita subdosificar (el parásito resiste) o sobredosificar.
- **La clínica necesita saber qué se dio y cuándo** para no repetir producto ni recomendar el mismo principio activo si ya falló.
- **Encaja con lo que ya existe.** Funciona como una vacuna: producto, fecha, próxima dosis y autor. El carnet de vacunas con línea de vida de la app se puede reutilizar.
- **Hoy es solo un archivo.** `DEWORMING` es una categoría de documento: un PDF o una foto que nadie puede consultar, filtrar ni usar para recordar.

### 6.2 Qué se guarda

En **Medical**, como una entidad nueva de prevención (no se mezcla con vacunas para no romper a quien ya las consume):

| Campo | Tipo | Detalle |
|---|---|---|
| `id`, `petId` | uuid | |
| `kind` | `INTERNAL` / `EXTERNAL` | Interna (lombrices) o externa (pulgas y garrapatas). |
| `product` | texto obligatorio | Nombre comercial. |
| `activeIngredient` | texto, opcional | Principio activo. |
| `dose` | texto | "1 tableta", "2,5 ml". |
| `weightKg` | número, opcional | Peso al aplicar. Se sugiere el último peso registrado. |
| `applicationDate` | fecha | No futura. |
| `nextDoseDate` | fecha, opcional | Próxima dosis. Si no se envía, se propone según el esquema. |
| `administeredBy` | `OWNER` / `CLINIC` | Quién lo aplicó. |
| `veterinaryId` / `employeeId` | uuid o `null` | Si lo aplicó una clínica. |
| `notes` | texto, opcional | |
| `status` | `ACTIVE` / `ENTERED_IN_ERROR` | |

### 6.3 La lógica del ciclo

**Estado de cada tipo** (igual que las vacunas, para usar los mismos chips): `Al día`, `Por vencer`, `Vencida`, `Sin registro`. Se calcula con `nextDoseDate` frente a hoy.

**Esquema sugerido por edad** (referencia general; **debe validarlo un veterinario antes de implementarse**, porque cambia según producto y región):

| Edad | Frecuencia aproximada |
|---|---|
| Cachorros y gatitos, desde las 2 a 3 semanas hasta los 3 meses | cada 2 semanas |
| De 3 a 6 meses | mensual |
| Más de 6 meses | cada 3 meses (interna); la externa según el producto, comúnmente mensual |

El backend (o el front, mientras tanto) propone `nextDoseDate` con esa tabla a partir de `birthDate`. **La clínica puede cambiarla**: la fecha propuesta es una sugerencia, no una orden.

**Recordatorios:**
- Aviso al dueño 7 días antes y el día de la dosis, con el mismo mecanismo que las vacunas (hoy existe `/api/cron/vaccine-reminders`; se agrega el equivalente de desparasitación).
- La dosis aparece como evento en el calendario de la mascota.
- Si se pasa la fecha, el estado cambia a `Vencida` y el aviso se repite una vez.

### 6.4 App móvil del dueño

- **Perfil de la mascota:** tarjeta **"Desparasitación"** junto a la de vacunas, con interna y externa por separado, el estado (Al día, Por vencer, Vencida) y la próxima fecha. Botón "Registrar desparasitación" (`OWNER` y `EDITOR`).
- **Pantalla "Registrar desparasitación"**, parecida a "Registrar vacuna": tipo (interna o externa), producto, fecha, peso (se rellena con el último), próxima dosis (propuesta, editable) y notas.
- **Línea de vida:** se reutiliza la vista de línea de vida de vacunas para mostrar las dosis pasadas, las próximas y las retrasadas.
- **Recordatorios:** notificación y evento en el calendario.
- **Si la aplicó una clínica:** se ve "Aplicada por Clínica Patitas · Dra. Ruiz".

### 6.5 Panel de la clínica

- **Pestaña Resumen:** bloque "Prevención" con el estado de desparasitación interna y externa y la última dosis.
- **Registrar desparasitación:** acción disponible para quien puede aplicar vacunas (`NURSING_WRITE`: auxiliar y veterinario). Mismo diálogo que "Aplicar vacuna", con producto, dosis, peso del día y próxima dosis.
- **Lista de Pacientes:** nuevo filtro **"Desparasitación vencida"** y columna de estado, con contador, igual que el filtro de vacunas vencidas.
- **Inicio:** contador "Desparasitaciones vencidas", con la acción "Avisar a los dueños" que ya existe para vacunas.

### 6.6 Criterios de aceptación

- El dueño registra una desparasitación y la clínica con acceso la ve en el Resumen.
- Una clínica la registra y el dueño ve la próxima dosis y recibe el recordatorio.
- Para un cachorro, la próxima dosis propuesta sigue el esquema de la edad y se puede editar.
- El estado cambia solo a `Por vencer` y `Vencida` con el paso del tiempo.
- El filtro de Pacientes cuenta bien y desaparece de la lista al registrar la dosis.

---

## 7. Contrato propuesto para el backend

Las rutas siguen el gateway actual (`/api/...`). El nombre exacto de cada ruta lo confirma el backend; lo importante es la forma de los datos y los permisos.

### 7.1 Esterilización (servicio de mascotas)

| Método | Ruta | Quién | Notas |
|---|---|---|---|
| `POST /pets` y `PUT /pets/{id}` | existentes | Dueño | Aceptan `neuteredStatus`, `neuteredAt`. |
| `GET /pets/{id}` | existente | Dueño y clínicas con acceso | Devuelve `neuteredStatus`, `neuteredAt`, `neuteredSource`, `neuteredConfirmedBy`. |
| `PATCH /veterinary/{vetId}/patients/{petId}` | nueva | Clínica (`CLINICAL_READ_BASIC` o superior para leer, `NURSING_WRITE` o superior para confirmar) | Para que la clínica confirme o corrija. |
| `GET /veterinary/{vetId}/patients/{petId}` | existente | Clínica | Debe incluir los campos nuevos, junto a `sex` y `birthDate`. |

### 7.2 Alergias (Medical)

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| `GET /allergies?petId=` | | Dueño de la mascota o clínica con acceso (`CLINICAL_READ_BASIC`) | Devuelve `allergyStatus` y la lista. |
| `POST /allergies` | | Dueño (`SUSPECTED`) o veterinario con tarjeta (`CONFIRMED`) | |
| `PATCH /allergies/{id}` | | Autor o veterinario con tarjeta | Confirmar, corregir, resolver o marcar por error. |
| `PUT /pets/{petId}/allergy-status` | | Dueño o veterinario | `UNKNOWN`, `NONE_KNOWN`. |
| `GET /pets/{id}/clinical-summary` | **publicar en el gateway** | `CLINICAL_READ_BASIC` | Hoy 404. Debe traer `allergies` y `allergyStatus`. |

Errores: `403 INSUFFICIENT_PERMISSION` (auxiliar intenta confirmar), `403 NO_ACCESS_TO_PET`, `404 ALLERGY_NOT_FOUND`, `400 VALIDATION_ERROR`.

### 7.3 Desparasitación (Medical)

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| `GET /dewormings?petId=` | | Dueño o clínica con acceso | Cada ítem con `status` calculado (`Al día`, `Por vencer`, `Vencida`). |
| `POST /dewormings` | | Dueño o `NURSING_WRITE` | Si falta `nextDoseDate`, la propone según la edad. |
| `PUT /dewormings/{id}` | | Autor o clínica con permiso | |
| `GET /dewormings/suggest?petId=&kind=` | | Dueño o clínica con acceso | Devuelve la próxima fecha sugerida. |
| `GET /cron/deworming-reminders` | | Clave interna | Avisos 7 días antes y el día de la dosis. |

### 7.4 Eventos y notificaciones

| Evento | Destinatario | Cuándo |
|---|---|---|
| `ALLERGY_CONFIRMED` / `ALLERGY_ADDED_BY_CLINIC` | Dueño | La clínica confirma o agrega una alergia. |
| `ALLERGY_ADDED_BY_OWNER` (grave) | Clínicas con acceso | El dueño registra una alergia grave. |
| `DEWORMING_DUE_SOON` / `DEWORMING_OVERDUE` | Dueño | 7 días antes y al vencer. |
| `DEWORMING_APPLIED_BY_CLINIC` | Dueño | La clínica registra una dosis. |

La bandeja de la app necesita `type` nuevos (`ALLERGY`, `DEWORMING`) y un campo `data` con `petId` para navegar al tocar.

---

## 8. Trabajo por ecosistema

### 8.1 Backend

- [ ] Pets: campos de esterilización en el modelo, el `POST`/`PUT` y las lecturas; que `vaccine` y `vetName` se guarden o se dejen de enviar (hoy se pierden).
- [ ] Medical: entidad y endpoints de alergias, con `allergyStatus`.
- [ ] Medical: entidad y endpoints de desparasitación, con el cálculo de estado y la sugerencia por edad.
- [ ] Publicar `GET /pets/{id}/clinical-summary` en el gateway.
- [ ] Permitir que la clínica lea estos datos cuando la mascota está compartida.
- [ ] Recordatorios de desparasitación (cron) y eventos del punto 7.4.

### 8.2 App móvil del dueño (este repo)

Archivos y puntos de entrada:

- [ ] `PetService/pet.ts` y la interfaz `Pet`: campos de esterilización; leer y enviar.
- [ ] `views/add-pet/`: selector de esterilización en el paso 2 y pregunta de alergias en el paso 3; modo edición.
- [ ] `views/pet-profile/`: esterilización en la tarjeta de datos; tarjeta "Alergias y alertas"; tarjeta "Desparasitación".
- [ ] Servicio y modelo nuevos (alergias y desparasitación), en el patrón de `VaccineService` y `models/`.
- [ ] Pantallas nuevas: "Agregar alergia" y "Registrar desparasitación" (patrón de `register-vaccine`); línea de vida de desparasitación (reutiliza `vaccine-timeline`).
- [ ] Recordatorios en calendario y en la bandeja de notificaciones.
- [ ] Respetar `canEdit` (el `VIEWER` solo lee).
- [ ] Diseño: **no existen pantallas de Figma para estos tres datos en la app**; hay que diseñarlas antes de codificar (ver 10).

### 8.3 Panel de la clínica (MyAnimaLogVet)

- [ ] `services/api/medical.api.ts` y modelos: alergias, estado de alergias y desparasitación.
- [ ] Cabecera de la historia y ficha del paciente: chip "Esterilizado" y alerta ámbar de alergia, con los estados `UNKNOWN`.
- [ ] Pestaña Resumen: bloque "Alertas" completo y bloque "Prevención".
- [ ] Diálogo "Registrar alergia" (veterinario con tarjeta) y "Registrar desparasitación" (auxiliar y veterinario), en el patrón de `record.dialog.ts`.
- [ ] Confirmar esterilización desde la ficha, con sugerencia al registrar una cirugía de esterilización.
- [ ] Pacientes: filtro "Desparasitación vencida" y contador; Inicio: contador de vencidas.
- [ ] Aviso de alergia al agregar una medicación que coincide.
- [ ] Ajuste de diseño: confirmar con el equipo de diseño los estados "sin confirmar" y "sin preguntar".

---

## 9. Orden de entrega y criterios de aceptación

| Fase | Entrega | Por qué en este orden |
|---|---|---|
| **1. Seguridad** | Alergias (backend, móvil y panel) y publicar `clinical-summary` | Es el dato que evita un daño real. Y el panel ya tiene casi toda la pantalla. |
| **2. Perfil** | Esterilización (backend, móvil y panel) | Es un campo simple, pero cambia varios pasos del registro. |
| **3. Prevención** | Ciclo de desparasitación con recordatorios | Es el más grande: entidad nueva, lógica de edad, avisos y filtros. |

Una fase está terminada cuando se cumplen los criterios de aceptación de su sección (4.6, 5.6 y 6.6) **en los dos ecosistemas** y se probó el recorrido completo: el dueño registra en la app, la clínica ve en el panel, la clínica confirma, el dueño ve la confirmación.

---

## 10. Decisiones abiertas

1. **¿Dónde viven las alergias: Pets o Medical?** Se propone **Medical**: son datos clínicos con autor, fecha, gravedad e historia de cambios, no un atributo fijo de la mascota.
2. **¿Puede el dueño confirmar sus propias alergias?** Se propone que no: el dueño las declara (`SUSPECTED`) y solo un veterinario las confirma. Así la clínica sabe qué tan fiable es el dato.
3. **¿Quién valida el esquema de desparasitación por edad?** Debe revisarlo un veterinario del equipo antes de implementarlo; la tabla del punto 6.3 es una referencia general.
4. **¿La desparasitación va en una entidad nueva o extiende vacunas?** Se propone entidad nueva para no afectar a los clientes de vacunas; si el backend prefiere extender, hace falta un campo `kind` y filtros separados.
5. **¿Qué se hace con las categorías de documento `DEWORMING` y `ALLERGY_REPORT`?** Se mantienen como adjuntos (un PDF del laboratorio o del carnet), pero ya no son la fuente del dato.
6. **Diseño pendiente en Figma:** pantallas móviles para registrar alergias, registrar desparasitación, tarjetas del perfil y selector de esterilización; y en el panel, estados "sin confirmar" y "sin preguntar". Se quita además el chip de Microchip de la cabecera del diseño del panel.
7. **Datos de salud y consentimiento:** las alergias y los registros son información de la mascota, pero van ligados al dueño. Conviene que asesoría legal revise el texto de consentimiento al vincularse y al compartir.


---

## 11. Estado de implementación (20 de noviembre de 2026)

| Parte | Estado |
|---|---|
| **Backend Medical** | Hecho: `/allergies`, `/dewormings`, `/pets/{id}/clinical-profile` y `clinical-summary`, con `/corrections` (carpetas D9 y V10 de la colección). **Falta publicar en el gateway** esas rutas (hoy 404) y que `/pets/{id}/clinical-*` vayan a Medical, no a Pets. |
| **App móvil** | Hecho: sección propia de Desparasitación (estado por tipo, historial, registrar, anular), pantalla "Salud y alertas" (esterilización y alergias: agregar, resolver, marcar por error), tarjetas y aviso de alergia grave en el perfil. Falta: preguntas en el registro de mascota, recordatorios en calendario y notificaciones. |
| **Panel Vet** | Hecho: pestañas **Desparasitación** y **Alergias** en la historia, chips de esterilización y alergias en la cabecera, bloque "Prevención" en el Resumen, diálogos para registrar alergia, **confirmar** la del dueño, confirmar esterilización y registrar desparasitación, y aviso de alergia al agregar un medicamento que coincide. Falta: filtro "Desparasitación vencida" en Pacientes y contador en Inicio. |

**Decisión de diseño móvil:** la desparasitación va como sección propia junto a Vacunas (no dentro), porque sus datos son distintos; comparte el lenguaje de estados y la línea visual de vacunas.
