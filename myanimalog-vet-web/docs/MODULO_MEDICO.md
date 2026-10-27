# Módulo médico · cómo funciona y cómo se relaciona con MyAnimaLog

> Cubre las vistas de **Historia clínica** y las **fichas de paciente** del panel de la clínica (Figma `e9FbM805Y2oAmOgIbcL0Hj`). Fuentes: los frames del Figma y `MYANIMALOG_VET_MAESTRO.md` (§3 permisos, §10 Medical), `MYANIMALOG_VET_CLIENTE.md` (§5–§9) y `MYANIMALOG_VET_NEGOCIO.md`.
> Estado en código: las vistas Inicio, Agenda y Pacientes ya existen; **la historia clínica todavía no está programada** (solo diseño).

## 1. La idea central

**La historia de la mascota es del dueño y viaja con ella entre clínicas.** La clínica solo ve las mascotas que el dueño le comparte, y el dueño puede quitarle el acceso cuando quiera. Lo que la clínica ya registró **se queda** en la historia aunque pierda el acceso.

- **MyAnimaLogVet** (esta app, la clínica) es dueño de *quién atiende, dónde, cuándo y con permiso de quién*. **Nunca guarda historia clínica.**
- **MyAnimaLog** (app del dueño, B2C) guarda la mascota, sus documentos y le deja ver toda la historia.
- **Medical** (servicio de historia) guarda consultas, vacunas, tratamientos, cirugías, laboratorios y peso.

## 2. Mapa de pantallas

| Pantalla | Frame | Para qué |
|---|---|---|
| Pacientes (lista) | `1958:174` | Buscar y filtrar pacientes; abre la ficha |
| Ficha de paciente (normal) | `1959:174` | Resumen rápido del paciente |
| Ficha · Por reclamar | `2030:783` | Paciente que registró la clínica y el dueño aún no tiene la app |
| Ficha · Acceso revocado | `2030:225` | El dueño quitó el acceso |
| Ficha · Asistente o veterinario sin tarjeta | `2030:1352` | Qué puede hacer quien no escribe historia |
| Historia clínica · **Resumen** | `1997:225` | Línea de tiempo + alertas + de dónde viene la historia |
| Historia clínica · **Consultas** | `1998:225` | Consultas con signos vitales, anamnesis, diagnóstico y plan |
| Historia clínica · **Vacunas** | `1998:710` | Carnet y próximas dosis |
| Historia clínica · **Tratamientos** | `2001:225` | Medicación activa y finalizada |
| Historia clínica · **Cirugías** | `2001:747` | Recorrido de la cirugía con documentos |
| Historia clínica · **Laboratorio** | `2002:225` | Exámenes con parámetros y rangos |
| Historia clínica · **Peso** | `2002:719` | Gráfica y registros (clínica y dueño) |
| Historia clínica · **Documentos** | `2026:225` | Archivos de la mascota |
| Historia clínica · **Recepción: resumen básico** | `2027:225` | Lo único que ve recepción |
| Historia clínica · **Registrar visita** | `2028:225` | Formulario de nueva consulta |
| Historia clínica · **Paciente nuevo sin historia** | `2029:225` | Estado vacío con guía |

## 3. Cabecera común de la historia

Toda pestaña comparte la misma cabecera:
- **Ruta:** *Pacientes / Toby / Historia clínica*.
- **Mascota:** nombre, etiqueta **"Historia compartida por el dueño"**, datos (*Perro · Beagle · Macho · 4 años (12 jun 2022) · 12,4 kg*).
- **Dueño** (nombre y teléfono) con **Llamar**.
- **Acciones:** **Registrar visita** (primaria), **Nueva cita**, **Subir documento**.
- **Chips de seguridad:** *Esterilizado*, *Microchip 985 112 004 567 321*, **alerta** (*Alérgico a la penicilina*) en ámbar. Siempre visible arriba.
- **Pestañas con contadores:** Resumen · Consultas 6 · Vacunas 5 · Tratamientos 4 · Cirugías 1 · Laboratorio 4 · Peso 7 · Documentos 3.
- **A la derecha de las pestañas** se indica **quién escribe** en la pestaña activa (ver §5).

## 4. Qué muestra cada pestaña

### Resumen
- **Línea de tiempo** con filtros *Todo · Esta clínica · Otras clínicas*: cita próxima, tratamiento, cirugía, vacuna, laboratorio, consulta y peso, cada una con su clínica de origen.
- **Alertas clínicas** (arriba a la derecha): ej. *Alergia a la penicilina — reacción a la amoxicilina, la registró VetCentro Bocagrande el 2 may 2025.*
- **Vacunas** (Vigente / Por vencer / Vencida con fechas) y **Peso** con variación.
- **"De dónde viene la historia"**: conteo por clínica (*Clínica Patitas 17 · VetCentro Bocagrande 6 · Registrado por el dueño 3*) y el aviso *"La historia es de Carlos: viaja con Toby entre clínicas. Él puede quitar el acceso cuando quiera."*

### Consultas
Lista a la izquierda (fecha, motivo, profesional, clínica) y detalle a la derecha:
- **Encabezado:** fecha y hora, *desde la cita "Consulta general"*, autor con **Tarjeta verificada** (nombre, clínica, *Médico veterinario · Tarjeta profesional 12345*).
- **Signos vitales:** peso, temperatura, frecuencia cardíaca y respiratoria, mucosas, condición corporal (con estado Normal/Ideal).
- **Texto clínico:** motivo, anamnesis, examen físico, diagnóstico, plan.
- **Relacionados:** laboratorios y cirugías enlazados.
- **Auditoría:** *"Creada el 3 sep, 11:42 a. m., por Dr. Luis Pérez · editada 1 vez (4 sep)"* + **Ver cambios**. **Editar** solo en consultas de la propia clínica.

### Vacunas
- Resumen (*1 vigente · 1 por vencer · 1 vencida*), **Enviar recordatorio de la vencida**, **Aplicar vacuna**.
- **Carnet:** vacuna, aplicada, **lote**, laboratorio, quién aplicó, próxima dosis, estado (Vigente / Por vencer / Vencida / Anterior) y **origen** (clínica o dueño).
- **Próximas dosis** y **Vencidas**, con aviso inteligente: *"Toby viene hoy a las 10:30 a. m.: se puede aplicar en la misma visita."*
- *"El dueño recibe un recordatorio automático antes de cada próxima dosis."*

### Tratamientos
- **Antes de recetar:** caja de alergia (*evita amoxicilina, ampicilina y otras penicilinas; en el posoperatorio se usó clindamicina*).
- **Activos** (con progreso *Día 12 de 28*), **historial de medicamentos** (dosis, frecuencia, duración, estado: Activo/Terminado/Reacción) e **indicaciones**. **Finalizados** al pie. **Nuevo tratamiento** crea uno.

### Cirugías
- **Recorrido** de la cirugía: valoración prequirúrgica → exámenes → cirugía → retiro de puntos → control posoperatorio, con fechas y responsables.
- **Detalle:** fecha, cirujano (con tarjeta verificada), duración, anestesia, riesgo ASA, descripción, instrucciones posoperatorias.
- **Documentos** adjuntos (consentimiento firmado, protocolo anestésico) con **Ver** y **Subir**.
- *"Solo Clínica Patitas puede editar o borrar esta cirugía. Cada cambio queda registrado."*

### Laboratorio
- Lista de **exámenes** (Química sanguínea, Hemograma, Citología, Raspado) con estado (*1 fuera de rango*, Normal, Anormal, Negativo) y clínica.
- **Detalle:** tabla *parámetro · resultado · rango normal · estado*, **interpretación** del veterinario y el **PDF** del laboratorio. **+ Agregar** para nuevos.

### Peso
- **Peso actual** y variación (*+1,2 kg desde marzo (+11 %)*), **Registrar peso**.
- **Gráfica** con series *Clínica* y *Dueño (desde la app)* y rangos (6 meses · 1 año · todo).
- **Tabla de registros:** fecha, peso, cambio, quién lo registró y origen. Los del dueño se marcan con borde y se explican: *"Carlos puede pesar a Toby en casa y anotarlo en la app."*

### Documentos
- **Lista** con filtros *Todos · Esta clínica · Otras clínicas · Del dueño*; cada archivo trae tipo, fecha, tamaño, quién lo subió y la clínica. Acciones: **Ver**, **Descargar** y **Eliminar** (solo los que subió *esta* clínica).
- **Subir documento:** zona de arrastre (PDF, JPG o PNG, máx. 10 MB) y **tipo** (Laboratorio, Imagen diagnóstica, Consentimiento, Fórmula, Certificado, Vacunas, Otro). *"El dueño verá este documento en la app, con el nombre de tu clínica."*
- **Quién puede subir:** dueño, administrador, veterinario y asistente: **sí**; recepción: **no**.

### Registrar visita (`2028:225`)
- **Contexto:** *Nueva consulta · Desde la cita: Control posoperatorio · hoy 10:30*; **"Ten en cuenta"** (alergia y tratamiento activo).
- **Autor:** profesional con tarjeta verificada — *"la consulta queda a su nombre"*.
- **Formulario:** signos vitales, motivo, anamnesis, examen físico, diagnóstico y plan.
- **"Agregar a esta consulta":** tratamiento y medicación, vacuna aplicada, orden de laboratorio, cirugía, documento.
- **"Al guardar":** la cita pasa a *Atendida*; el dueño ve la consulta en su app como *"Clínica Patitas · Dra. Sara Ruiz"*; si hay vacuna, el carnet y la línea de vida del dueño se actualizan.
- Se guarda con nombre y hora; cada edición queda en el historial de cambios. **Cancelar / Guardar consulta**.

### Paciente nuevo sin historia (`2029:225`)
Estado vacío: *"Nala todavía no tiene historia — Juliana la compartió hoy desde la app."* Muestra el **origen** (*Compartida por Juliana Castro desde la app el 13 oct 2026*) y guía: preguntar por alergias, subir el carnet en papel, usar el peso de hoy como punto de partida. Botones **Registrar primera visita** y **Subir documento anterior**.

## 5. Quién puede hacer qué

La etiqueta al lado de las pestañas lo dice en cada una:

| Pestaña | Quién escribe (Figma) |
|---|---|
| Resumen | Recepción: solo Resumen |
| Consultas | Veterinarios |
| Vacunas | Vets y auxiliares aplican |
| Tratamientos | Veterinarios recetan |
| Cirugías | Veterinarios |
| Laboratorio | Veterinarios |
| Peso | Vets, auxiliares **y el dueño** |
| Documentos | Todos menos recepción |

**Permisos del backend** (`MAESTRO.md` §3.2): `CLINICAL_READ` (leer historia completa), `CLINICAL_READ_BASIC` (nombre, especie, alergias, próxima cita), `CLINICAL_WRITE` (visitas, diagnóstico, tratamientos, cirugías, laboratorios), `NURSING_WRITE` (peso, signos, vacunas) y `DOCUMENT_UPLOAD`.

| Rol | Lee historia | Escribe clínica | Peso y vacunas | Documentos |
|---|:-:|:-:|:-:|:-:|
| Dueño de la clínica / Admin | ✅ | 🔑 | 🔑 | ✅ |
| Veterinario | ✅ | 🔑 | ✅ | ✅ |
| Auxiliar | ✅ | — | ✅ | ✅ |
| Recepción | solo resumen básico | — | — | — |

🔑 = solo con **tarjeta profesional verificada**. El perfil del veterinario (`2039:267`) lo explica: mientras lo verifican *puede ver la agenda y la historia, aplicar vacunas y registrar peso, pero no consultas, diagnósticos, tratamientos ni cirugías*. Si la clínica no está `ACTIVE`, no se atiende.

### Recepción (`2027:225`)
Ve un **resumen básico**: próxima cita (con **Marcar llegada**), historial de citas, alertas clínicas, vacunas (Vigente / Por vencer / Vencida), tratamientos activos, último peso y datos del dueño. Un cuadro lo aclara: *"Qué no ves con tu rol: consultas, diagnósticos, laboratorios, cirugías y documentos son del equipo clínico."*

### Fichas de paciente
- **Normal:** estado de vacunas, "Conectado a la app", próxima cita, "Paciente desde…", dueño con **Llamar**, alerta clínica.
- **Por reclamar:** *"Registrado por la clínica"*, aviso *"Invitación enviada a carlos.perez@correo.com — vence el 6 nov 2026 (30 días)"*, botones **Reenviar invitación** y **Editar datos**. *"Cuando Carlos acepte la invitación, Max pasa a su cuenta y tu clínica conserva el acceso."*
- **Acceso revocado:** *"El dueño quitó el acceso"* (fecha), *"Ya no puedes ver la historia, los documentos ni las vacunas de Kira"*, la cita futura *"se canceló sola al quitar el acceso"*, y *"Para atenderla otra vez, el dueño tiene que compartirla desde la app (o con el código QR de recepción)"*.
- **Asistente / veterinario sin tarjeta:** ficha con acciones **Aplicar vacuna** y **Registrar peso**, alerta de vacunas (*"Polivalente vence el 20 oct. Puedes aplicarla en la cita de hoy."*) y pie *"Las consultas, diagnósticos y tratamientos los registra un veterinario con tarjeta verificada. Vacunas y peso: asistentes y veterinarios."*

## 6. Cómo se relaciona con MyAnimaLog (la app del dueño)

```
DUEÑO (MyAnimaLog)                          CLÍNICA (MyAnimaLogVet)
──────────────────                          ───────────────────────
Código o QR de la clínica  ──vincularse──▶  Aparece en Clientes
Elegir mascotas a compartir ──compartir──▶  Aparecen en Pacientes (Conectado)
                                            ▼
                                  Registrar visita / vacuna / peso
                                  (queda con el autor y la clínica)
◀── ve todo en su app como "Clínica X · Dra. Y"
Quitar acceso (por mascota o desvincularse) ─▶ Ficha "Acceso revocado", citas canceladas
```

| Hecho | Lo que pasa en la clínica | Lo que ve el dueño |
|---|---|---|
| Se vincula con QR/código | Cliente nuevo, "Vinculado con código QR" | Clínica en *Mis veterinarias* |
| Comparte una mascota | Paciente "Conectado"; la historia que ya tenía viaja con ella (*Esta clínica / Otras clínicas*) | *Clínicas con acceso* en el perfil |
| La clínica registra una consulta o vacuna | Se guarda con autor, hora y clínica (auditoría) | Consulta con el nombre de la clínica y el veterinario; el carnet y la línea de vida se actualizan |
| El dueño pesa a la mascota en casa | Aparece en **Peso** con borde, origen "Dueño · app" | Su registro (`Source = OWNER`) |
| La clínica registra a un paciente sin app | Ficha **Por reclamar** + invitación por correo (30 días) | Pantalla *Reclamar mascota*; la clínica **conserva** el acceso |
| Quita el acceso | Ficha **Acceso revocado**, cita futura cancelada; el acceso termina en < 1 min (caché de 60 s) | *Clínicas con acceso* sin esa clínica |
| Se desvincula | Cliente fuera de la lista; todas sus mascotas se revocan | La clínica sale de *Mis veterinarias* |
| Pide cita desde la app | Solicitud en la Agenda; al atender, la cita pasa a *Atendida* y se crea la visita | Su cita y la consulta posterior |

**Qué puede hacer el dueño con la historia** (`CLIENTE.md` §9): ver todo; **no** crear ni editar consultas, tratamientos, cirugías, laboratorios ni vacunas (403); **sí** registrar peso; no borra cirugías.

**Notificaciones al dueño:** vinculación, mascota reclamada, recordatorio de próxima dosis, y mensajes con contexto (*"Clínica Patitas aplicó la vacuna antirrábica a Max"*).

## 7. Cómo funciona por dentro (backend)

- **Quién guarda qué:** Veterinary = permisos y vínculos; Medical = historia; Pets = mascota y dueño; Calendar/citas = agenda; Notifications = avisos; IA = resúmenes previos.
- **Token de clínica:** lleva clínica, rol y `licensed`. Medical consulta a Veterinary si la clínica tiene acceso a esa mascota y con qué permisos (caché 60 s); si Veterinary no responde → 503 (no es "sin permiso").
- **Autoría:** con token de clínica, `veterinary_id` y el empleado se toman del token, **nunca del body**.
- **Auditoría (`clinical_audit_log`):** cada crear/editar/borrar guarda actor, clínica y el antes/después. Una historia editada sin rastro no es aceptable.
- **Visita desde una cita:** `POST /api/visits` acepta `appointmentId`; solo se crea **después** de marcar la cita como atendida y no puede haber dos visitas por cita (409).
- **Eventos:** llevan `veterinaryId/Name`; el destinatario es el **dueño** de la mascota; si es `UNCLAIMED`, se usa el contacto de la invitación.
- **Resumen para recepción y IA:** `GET /api/pets/{petId}/clinical-summary` (alergias, vacunas vigentes/vencidas, tratamientos activos, último peso).
- **Matriz por ruta:** lectura → dueño (`requireOwner`) o `CLINICAL_READ`; escribir consultas/tratamientos/cirugías/labs → `CLINICAL_WRITE`; vacunas → `NURSING_WRITE`; peso → dueño (`OWNER`) o `NURSING_WRITE` (`CLINIC`); borrar cirugía → `CLINICAL_WRITE` y misma clínica que la creó.

## 8. Puntos a aclarar antes de programar

1. **Vacunas del veterinario sin tarjeta:** la matriz del maestro da `NURSING_WRITE` al veterinario sin llave 🔑, pero el texto de negocio y el perfil profesional dicen que escribir (clínico y enfermería) requiere tarjeta. El Figma dice "asistentes y veterinarios aplican". Confirmar con el backend.
2. **Datos de ejemplo distintos entre frames:** tarjeta profesional de Luis (`12345`), de Sara (`23456`) y formatos `MV-xxxxx` en Equipo; el mismo paciente figura con distintos pesos en pantallas diferentes (12,4 / 12,2 kg).
3. **Documentos del dueño:** las del dueño se muestran, pero solo se pueden eliminar las de la propia clínica; confirmar que el dueño ve el nombre de la clínica que subió cada uno.
4. **Peso del dueño** vs. **vacunas del dueño:** el dueño puede registrar peso pero no vacunas; la app móvil hoy permite registrar visitas y vacunas, y con MED-03 esos formularios darán 403.
5. **Estado vacío:** la 2029 muestra un chip de alergia ("Alérgico a la penicilina") aunque dice "Sin alergias registradas": revisar el dato de ejemplo.
