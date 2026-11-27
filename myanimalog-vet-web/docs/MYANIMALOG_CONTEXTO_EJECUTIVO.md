# MyAnimaLog — Documento ejecutivo del proyecto

> Visión completa del proyecto, de lo más pequeño (un dato de una mascota) a lo más grande (el modelo de negocio y el ecosistema). Pensado para quien llega sin contexto: jurado, inversionista, aliado, cliente o nuevo integrante del equipo.
> Fecha: 22 de noviembre de 2026.
>
> **Sobre las cifras:** los precios, la conversión y los escenarios de ingresos son **supuestos de trabajo**, no datos validados. Lo dicho de la competencia viene de información pública, no de un análisis a fondo. Las dos cosas están marcadas donde aparecen.

## Índice

1. El proyecto en una página
2. El problema
3. La solución
4. De lo más pequeño a lo más grande
5. Para quién es (público objetivo)
6. Qué hace cada producto
7. Cómo funciona por dentro
8. Qué nos diferencia
9. Mercado y competencia
10. Modelo de negocio
11. Confianza, privacidad y seguridad
12. Estado actual del proyecto
13. Riesgos y supuestos por validar
14. Hoja de ruta
15. Glosario

---

## 1. El proyecto en una página

**MyAnimaLog** es una plataforma digital para el cuidado de las mascotas con dos caras que se alimentan entre sí:

| | **MyAnimaLog** (B2C) | **MyAnimaLogVet** (B2B) |
|---|---|---|
| Quién la usa | Dueños de mascotas | Veterinarias y su personal |
| Formato | App móvil (Ionic/Angular, también web) | Panel web (SaaS) |
| Para qué | Guardar y compartir la vida de la mascota: perfil, vacunas, historial médico, documentos, citas | Gestionar la clínica: equipo, pacientes, agenda, atención clínica |
| Cuesta | Gratis, con plan Premium opcional | Plan gratuito y planes de pago |

**La idea central:** *la historia de la mascota es del dueño y viaja con ella.* No queda atrapada en el sistema de una clínica. El dueño decide a qué clínica se la muestra, y puede quitarle el acceso cuando quiera.

**Qué resuelve, en una frase:** que una mascota llegue a cualquier clínica **con su historia completa y confiable**, y que la clínica sepa **quién escribió cada dato y con qué licencia**.

**Complementos:** un asistente de IA para el dueño (consultas, registrar vacunas, agendar citas con confirmación), clínicas verificadas con documentos y registro oficial, y avisos automáticos de vacunas y citas.

Es un **proyecto de grado** con visión de producto: se construye como un ecosistema de microservicios real, desplegado en la nube.

---

## 2. El problema

### Para el dueño
- La historia de su mascota está **dispersa**: carnets en papel, fotos de exámenes, mensajes de WhatsApp, cada clínica con su propio sistema.
- Cuando cambia de clínica, **empieza de cero**: le preguntan de memoria vacunas, alergias y tratamientos.
- **Olvida fechas**: vacunas, desparasitaciones, controles.
- No sabe si el veterinario o la clínica **tienen sus papeles al día**.
- Si cuida mascotas con otra persona (pareja, familia, paseador), no hay una forma ordenada de compartir.

### Para la clínica
- Recibe pacientes **sin historia previa**: pierde tiempo en la primera consulta y arriesga errores (por ejemplo, recetar algo a quien es alérgico).
- Pierde ingresos por **inasistencias** a citas.
- Le cuesta **conseguir clientes nuevos**.
- Tiene **miedo a migrar** de software (sus datos actuales).
- Su software suele tener la historia **encerrada**: el paciente no puede llevársela.

### Para el sector
- Informalidad: hay quien atiende sin tarjeta profesional o clínicas sin los papeles al día, y no hay una señal clara de confianza para el dueño.

---

## 3. La solución

Un ecosistema donde **el dueño es el centro** y las clínicas se conectan con su permiso.

1. **El dueño** registra a su mascota y mantiene su historia: perfil, vacunas, desparasitación, alergias, esterilización, visitas, tratamientos, laboratorios, cirugías, peso y documentos.
2. **El dueño comparte** esa historia con una clínica escaneando un QR o escribiendo un código. Comparte **mascota por mascota** y puede **revocar** en cualquier momento.
3. **La clínica** ve a las mascotas que le compartieron, atiende, y registra lo que hace con su nombre y su licencia. Lo que registra **queda en la historia del dueño**.
4. **Si el dueño no tiene la app**, la clínica registra a la mascota y le envía una invitación para reclamarla; así cada clínica **trae usuarios nuevos** a la plataforma.
5. **La confianza** se construye con clínicas y veterinarios **verificados** (documentos + IA + revisión humana + registro oficial) y con **auditoría** de quién escribió cada dato.
6. **La IA** apoya: ayuda al dueño a consultar y registrar, y ayuda a revisar documentos. **Nunca decide sola** nada clínico ni de verificación.

---

## 4. De lo más pequeño a lo más grande

El producto se entiende mejor por capas, cada una apoyada en la anterior.

### Nivel 1 — Un dato
Una alergia ("Penicilina, grave"), una dosis de desparasitación, una vacuna, un peso. Cada dato lleva **quién lo registró, cuándo y con qué origen** (dueño o clínica). Nada se borra en silencio: se corrige con motivo, y queda el historial de cambios. "No sé" es una respuesta distinta de "no tiene".

### Nivel 2 — Una mascota
Su perfil (foto, especie, raza, nacimiento, sexo, peso), su carnet de vacunas con línea de vida, su estado de desparasitación (interna y externa), sus alergias, si está esterilizada, sus visitas, tratamientos, laboratorios, cirugías y documentos. Alertas visibles, por ejemplo una **alergia grave**.

### Nivel 3 — Un dueño
Varias mascotas, un calendario de citas y recordatorios, notificaciones, **perfiles compartidos** (invitar a otra persona como editor o solo lector), un mapa de veterinarias cercanas y un **asistente de IA**.

### Nivel 4 — Una clínica
Su equipo con **roles y permisos**, su catálogo de servicios y horarios, su agenda, su lista de pacientes y clientes, y la historia clínica de lo que atiende. Su código/QR de vinculación y su sello de verificada.

### Nivel 5 — La relación dueño ↔ clínica
El **consentimiento**: el dueño vincula la clínica, comparte mascotas, ve qué clínicas tienen acceso y las revoca. Las citas se piden desde la app y se confirman desde el panel. Lo que la clínica registra vuelve al dueño.

### Nivel 6 — La red de clínicas
Como la historia viaja con la mascota, **cualquier clínica autorizada** la ve. Eso crea el efecto de red: cuantos más dueños, más valor para la clínica; cuantas más clínicas, más valor para el dueño.

### Nivel 7 — La plataforma
Microservicios (cuentas, mascotas, historia médica, veterinarias, calendario, notificaciones, IA), seguridad por token, administración de la plataforma (verificar clínicas) y un modelo de negocio con dos fuentes de ingreso.

---

## 5. Para quién es (público objetivo)

### Usuarios principales

| Segmento | Quién es | Qué necesita | Qué le damos |
|---|---|---|---|
| **Dueño de mascota** | Persona o familia con una o varias mascotas, con celular | Tener todo en un lugar, no olvidar fechas, cambiar de clínica sin perder historia | App gratuita, recordatorios, compartir con control |
| **Cuidador / familiar** | Pareja, familia, paseador | Ver o registrar datos de una mascota ajena | Perfiles compartidos con roles (editor / solo lector) |
| **Consultorio pequeño y clínica mediana** | Veterinaria independiente de 1 a 10 personas | Ordenar agenda e historias, conseguir clientes, reducir inasistencias | Panel web con planes desde gratis |
| **Veterinario / auxiliar / recepción** | Personal de la clínica | Atender y registrar con permisos según su rol | Roles y permisos ligados a la licencia |
| **Equipo de la plataforma** | Administradores de MyAnimaLog | Verificar clínicas y profesionales | Panel de administración con apoyo de IA |

### Segmento de entrada recomendado
**Consultorios pequeños y clínicas nuevas.** Una clínica grande suele exigir caja, inventario y facturación electrónica antes de cambiar de sistema; esas funciones están en fases posteriores. Los pequeños valoran más conseguir clientes, ordenar la agenda y no perder pacientes.

### Mercado geográfico
**Colombia** para empezar: NIT con dígito de verificación, verificación contra el registro oficial (COMVEZCOL), zona horaria de Bogotá, prueba gratuita de 30 días.

### Otros públicos del documento
- **Jurado / universidad:** ver las secciones 7, 10 y 12.
- **Inversionista o aliado:** secciones 8, 9, 10 y 13.
- **Una clínica interesada:** secciones 6, 8 y 10.

---

## 6. Qué hace cada producto

### MyAnimaLog — la app del dueño
- **Cuenta:** registro, ingreso con correo o Google, recuperación de contraseña.
- **Mascotas:** crear y editar con foto; al registrar, se pregunta si está esterilizada y si tiene alergias.
- **Vacunas:** carnet con **línea de vida** (aplicadas, pendientes, retrasadas).
- **Salud:** **desparasitación** (interna y externa, con próxima dosis sugerida según la edad), **alergias** (con gravedad y quién las confirmó) y **esterilización**.
- **Historial médico:** visitas, tratamientos, laboratorios y cirugías.
- **Documentos:** subir y consultar archivos de la mascota.
- **Calendario:** citas y recordatorios.
- **Perfiles compartidos:** invitar a otras personas con rol de editor o solo lector.
- **Mapa de veterinarias:** buscar cercanas, ver ruta, llamar, agendar.
- **Parte Vet:** vincularse a una clínica con código o QR, compartir mascotas, ver y revocar qué clínicas tienen acceso.
- **Asistente de IA:** chat para consultar y pedir acciones (crear mascota, agendar cita, registrar vacuna) que **siempre piden confirmación**. Conserva el historial de conversaciones por cuenta. Botón flotante en todas las pantallas.
- **Notificaciones** y tutoriales de uso.

### MyAnimaLogVet — el panel de la clínica
- **Registro y verificación** de la clínica y de cada veterinario.
- **Inicio:** resumen del día, pendientes y accesos rápidos.
- **Agenda:** citas por día y profesional; confirmar, reprogramar, cancelar, check-in.
- **Pacientes y clientes:** las mascotas compartidas y sus dueños; código y QR para vincular, con envío por WhatsApp o correo.
- **Historia clínica del paciente:** consultas, vacunas, **desparasitación**, **alergias** (confirmar las del dueño, registrar nuevas), esterilización, tratamientos, cirugías, laboratorio, peso y documentos. Aviso si se receta algo que coincide con una alergia.
- **Equipo:** invitar personal, asignar roles, activar o desactivar.
- **Servicios y horarios, Mi clínica y Plan.**
- **Administración de la plataforma:** revisar y aprobar clínicas y profesionales.

---

## 7. Cómo funciona por dentro

### Principio de arquitectura
Cada servicio es dueño de **una** cosa y no guarda lo de otros:

| Servicio | Es dueño de… |
|---|---|
| **user-service** | Cuentas, ingreso, emisión de tokens |
| **pet-service** | La mascota, su foto, documentos, compartir entre personas |
| **medical** | La historia clínica: visitas, vacunas, peso, tratamientos, cirugías, laboratorio, **alergias y desparasitación** |
| **veterinary-service** | Quién atiende, dónde, cuándo y con permiso de quién: clínicas, verificación, personal, pacientes, catálogo, suscripción. **No guarda historia clínica.** |
| **calendar** | Citas y disponibilidad |
| **notifications** | Correos y avisos a partir de eventos |
| **IA-service** | El asistente del dueño y el pre-análisis de documentos |
| **API Gateway** | Puerta única hacia todos los servicios |

### Flujo típico
1. El dueño registra a su mascota en la app.
2. En la clínica, escanea el QR de recepción y comparte a la mascota.
3. La clínica ve a la mascota, atiende y registra la visita y la vacuna con su licencia.
4. El dueño ve el registro en su app y recibe el recordatorio de la próxima dosis.
5. Si cambia de clínica, la nueva ve la misma historia (con su permiso).
6. Si revoca el acceso, la clínica deja de ver la historia (lo que ya registró no se borra).

### Verificación de clínicas (confianza)
**Decisión: híbrido.** La IA pre-analiza los documentos y una persona decide.
1. La clínica se registra y sube RUT, Cámara de Comercio y cédula del representante; cada veterinario sube su tarjeta profesional y cédula.
2. La IA revisa coherencia (NIT, razón social, nombres, fechas, actividad económica) y señala riesgo.
3. Una persona del equipo revisa los documentos y **confirma en el registro oficial (COMVEZCOL)**.
4. Aprueba, rechaza con motivo o pide corrección.
5. Al aprobar, la clínica pasa a activa, empieza su prueba gratuita y los veterinarios verificados obtienen permiso de **escribir historia clínica**.

**La IA nunca aprueba ni rechaza**: solo recomienda revisión. Si falla, la revisión humana sigue igual.

### Roles y permisos
Cinco roles en la clínica: `OWNER`, `ADMIN`, `VETERINARIAN`, `ASSISTANT`, `RECEPTIONIST`, más el administrador de la plataforma.
- Escribir historia clínica: **solo veterinarios con tarjeta verificada**.
- Aplicar vacunas, peso o desparasitación: auxiliares y veterinarios.
- Recepción: ve datos básicos (alergias y alertas), no la historia completa.
- Una clínica **nunca** ve datos de otra clínica.

### Datos de salud que viajan (diseño)
Cada dato lleva origen y autor. El dueño **declara**; el veterinario **confirma**. Las alergias declaradas quedan "sin confirmar" hasta que un veterinario con tarjeta las verifique. El esquema de próxima dosis de desparasitación por edad es una referencia general **que debe validar un veterinario** antes de producción.

---

## 8. Qué nos diferencia

1. **La historia es del dueño y viaja.** Cambiar de clínica no es empezar de cero. *No encontramos indicios de que el principal competidor lo ofrezca.*
2. **Clínicas y veterinarios verificados**, con revisión humana y registro oficial. *Ausencia de evidencia, no prueba: verificar antes de afirmarlo en público.*
3. **Permisos ligados a la licencia real:** quien no tiene tarjeta verificada no escribe historia clínica.
4. **Dueños sin app se vuelven usuarios:** la clínica registra la mascota y el dueño la reclama; cada clínica trae usuarios.
5. **Agenda con reserva desde la app**, sin doble reserva, con recordatorios.
6. **Seguridad real entre clínicas:** cada una solo ve lo que el dueño le compartió.
7. **IA como apoyo, siempre con confirmación humana.**
8. **Enfoque local:** pensado para Colombia (NIT, DIAN, COMVEZCOL).

**Matices honestos:**
- Quien paga es la clínica y para ella la verificación es una fricción; el beneficio lo percibe más el dueño. Se vende como **respaldo y sello de confianza**, no como trámite.
- La app gratuita para el cliente **no** es un diferencial por sí sola (el competidor ya la tiene); lo es la **portabilidad** y la **verificación**.
- La portabilidad solo vale con **muchos dueños y varias clínicas**: al inicio es más promesa que prueba.

---

## 9. Mercado y competencia

- Software veterinario en Colombia: aproximadamente **$70.000 a $300.000 COP al mes**.
- Competidores: GVET, Okvet, QVET, VeteSoft, Pegazoo, ACVet.
- **GVET:** sistema en la nube maduro, con app gratuita para clientes, facturación electrónica en Argentina y Chile, inventario y buenas reseñas.
- Según un estudio de Pet Industry Academy citado en el plan técnico, **el 80 % de los centros usa software y el 43 % considera cambiarlo**: hay mercado y hay rotación.

**Dónde la competencia probablemente va adelante:** inventario, facturación electrónica, madurez, soporte y reseñas.

**Dónde buscamos ganar:** historia portable, confianza (verificación), conseguir clientes para la clínica y volver usuarios a los dueños.

**Estrategia de precio:** entrar en la parte media y diferenciarse por valor, **no por ser el más barato**.

---

## 10. Modelo de negocio

*(Todas las cifras son supuestos de trabajo por validar.)*

### Dos fuentes de ingreso que se complementan

**A. Clínicas (B2B) — suscripción mensual**

| | **FREE** | **BASIC** | **PRO** |
|---|---|---|---|
| Precio/mes (COP) | $0 | ~$120.000 | ~$220.000 |
| Usuarios | 1 | 5 | Ilimitados |
| Pacientes | 100 | 1.000 | Ilimitados |
| Almacenamiento | 1 GB | 10 GB | 50 GB |
| Citas en línea | — | Sí | Sí |
| WhatsApp, reportes, resumen con IA | — | — | Sí |
| Sello de clínica verificada | Sí | Sí | Sí |

- **Prueba de 30 días del plan PRO** al aprobarse la clínica; si no paga, baja a FREE.
- **El sello de verificada va en todos los planes y no se vende:** si se pudiera comprar, el directorio perdería credibilidad.
- Los archivos que sube la clínica cuentan contra **su** espacio.
- Aviso al 80 % de la cuota; **nunca se borran datos por falta de pago**.
- Ideas: descuento anual, importación asistida de datos, abono de citas por pasarela de pago.

**B. Dueños (B2C) — freemium**
- **Gratis:** 5 mascotas, ~300 MB, historia completa, compartir y revocar siempre.
- **Premium ~$12.900/mes:** IA, ~5 GB, con prueba gratuita.
- **Mascota extra:** ~$5.000/mes desde la sexta.
- **Regla de confianza:** nunca se cobra por ver la historia ni por compartirla; si deja de pagar, conserva el acceso de lectura. El reclamo de una mascota registrada por una clínica **nunca se bloquea**.

### Cómo se alimentan
Las clínicas traen dueños (por el QR y el reclamo de pacientes) → los dueños llenan de valor la plataforma y algunos pagan Premium → más dueños hacen más atractivo el panel para las clínicas.

### Escenario optimista al mes 12 (supuestos)

| Fuente | Cálculo | Mensual |
|---|---|---|
| Clínicas | 25 en plan medio + 11 en el alto | ≈ $5,4 millones |
| Premium de dueños | 9.000 × 4 % × $12.900 | ≈ $4,6 millones |
| Mascotas extra | 9.000 × 1,5 % con ~2 extras × $5.000 | ≈ $1,35 millones |
| **Total** | | **≈ $11 millones COP/mes** |

Supuestos: 60 clínicas (60 % pagan), 150 dueños activos por clínica. **La conversión del dueño es la cifra más incierta** (con 2 % en vez de 4 %, ese ingreso baja a la mitad): medirla en el piloto. El acumulado del año 1 sería bastante menor que 12 veces el valor del mes 12.

### Costos a considerar (sin cifras confirmadas)
Infraestructura en la nube, **uso de IA** (por verificación y por consulta del dueño), comisión de la pasarela de pago, mensajería de WhatsApp, **revisión manual de verificaciones** (probablemente el costo más real), soporte e implementación. El punto de equilibrio debe calcularse con costos reales.

### Cómo se validará
Entrevistas con 8 a 10 clínicas variadas (consultorio pequeño, mediana, alguna que use otro software) y 3 a 5 dueños, usando el guion de `MYANIMALOG_VET_NEGOCIO.md`. Preguntas clave: ¿les importa la verificación?, ¿qué tiempo de espera aceptan?, ¿pagarían más por ella?, ¿qué los haría cambiar de software?

---

## 11. Confianza, privacidad y seguridad

- **Consentimiento por mascota y revocable.** La clínica solo ve lo que el dueño le compartió; si el dueño revoca, deja de ver (lo ya registrado se conserva como parte de la historia clínica).
- **Nada se borra en silencio.** Las correcciones llevan motivo y quedan versionadas (visitas, vacunas, tratamientos, alergias, desparasitación…).
- **Origen y autor en cada dato:** se sabe si lo escribió el dueño o una clínica, y quién.
- **Seguridad técnica:** tokens firmados (RS256) y validados por cada servicio, aislamiento estricto entre clínicas, renovación de sesión con rotación y detección de reuso, cambios de rol aplicados en pocos minutos.
- **Documentos de verificación** en almacenamiento privado, con enlaces firmados de corta duración; la IA no los guarda ni los usa para entrenar. Los de solicitudes rechazadas se borran a los 90 días.
- **Datos de salud y Ley 1581 (Colombia):** el aviso de tratamiento de datos debe mencionar el análisis con IA; conviene que asesoría legal revise el consentimiento al vincular y compartir, y la política sobre archivos enviados a la IA (se recomienda que el servicio no los conserve).
- **La IA asiste, no decide:** las acciones propuestas piden confirmación; la verificación de clínicas es siempre humana.

---

## 12. Estado actual del proyecto

*(Al 22 de noviembre de 2026.)*

### Hecho
- **App del dueño (desplegada en Firebase Hosting):** cuenta y sesión, mascotas, vacunas con línea de vida, historial médico, documentos, calendario, perfiles compartidos, mapa, **vincularse a clínicas y compartir/revocar**, **asistente de IA** (chat completo, mini chat, botón flotante, historial por cuenta y del servidor), **salud de la mascota** (desparasitación, alergias y esterilización, con registro al crear la mascota).
- **Panel de la clínica:** registro y verificación, inicio, agenda conectada al backend (se corrigió el límite de 31 días por consulta), pacientes y clientes con código/QR, **historia clínica conectada a Medical** y ahora con **alergias, esterilización y desparasitación**, equipo, servicios, plan.
- **Backend:** servicios de usuarios, mascotas, veterinarias, historia médica, calendario, notificaciones e **IA-service desplegado** (la cuenta de prueba ya tiene decenas de conversaciones en el servidor). Colección de Postman completa de Medical (dueño y veterinaria).
- **Calidad:** cientos de pruebas automáticas en la app del dueño y pruebas del cliente de Medical en el panel.

### Pendiente
- **API Gateway:** faltan las rutas hacia Medical para `/api/allergies`, `/api/dewormings`, `/api/pets/{id}/clinical-profile` y `/clinical-summary` (y `/api/documents`). El equipo de backend ya lo identificó; la regla de las rutas de mascotas debe ir **antes** de la genérica. Hasta entonces la app muestra esas secciones como "todavía no disponibles" (o se conecta directo a Medical con una variable de configuración).
- **Panel Vet:** "Registrar sin app" todavía es local (falta el endpoint de reclamo de mascotas); filtro de "desparasitación vencida" en Pacientes y contador en Inicio.
- **App del dueño:** recordatorios de desparasitación en calendario y notificaciones; directorio de clínicas, solicitud y gestión de citas, y reclamo de mascotas registradas por una clínica.
- **Producto:** plan de pago y límites (mascotas por dueño, almacenamiento), facturación electrónica, inventario, WhatsApp, importador de datos, documentos imprimibles con QR.
- **Validación:** esquema de desparasitación por edad con un veterinario; precios y conversión con clínicas piloto; aviso de tratamiento de datos con asesoría legal.

---

## 13. Riesgos y supuestos por validar

| Riesgo | Por qué importa | Cómo se maneja |
|---|---|---|
| **Efecto red** | La portabilidad solo vale con muchos dueños y varias clínicas | Piloto con pocas clínicas que traigan dueños; medir cuántos llegan por clínica |
| **Brechas básicas** (caja, inventario, facturación) | Una clínica grande no adopta un sistema sin ellas | Empezar por consultorios pequeños; integrar un facturador en una fase posterior |
| **Verificación manual** | No escala si crecen rápido | Medir tiempos; la IA reduce el trabajo; prometer respuesta en 24–48 h |
| **Conversión del dueño a Premium** | Es la cifra más incierta del modelo | Medirla en el piloto antes de proyectar |
| **Costo de la IA** | Puede comerse el margen | Medirlo por verificación y por uso; ofrecer IA en planes de pago |
| **Documentos falsificados muy bien hechos** | Pasan la IA | La consulta al registro oficial no se automatiza ni se vuelve un clic |
| **Datos de salud y privacidad** | Riesgo legal y de reputación | Consentimiento claro, revisión legal, mínimo de datos retenidos |
| **Dependencia entre equipos** | El gateway y varios endpoints aún no están publicados | Contratos documentados y pruebas con Postman; apps tolerantes a "no disponible" |
| **Afirmaciones sobre la competencia** | Pueden ser falsas | No afirmar públicamente sin comprobar |

---

## 14. Hoja de ruta

**Ahora (cierre de lo en curso)**
1. Publicar las rutas de Medical en el gateway y probar de punta a punta con datos reales.
2. Recordatorios de desparasitación; "Registrar sin app" y reclamo de mascotas.
3. Entrevistas a clínicas y dueños; piloto con 3 a 5 clínicas.

**Siguiente**
4. Directorio de clínicas y citas desde la app (disponibilidad, solicitud, cancelar, reprogramar).
5. Plan de pago, límites y medición de almacenamiento; suscripción de clínicas.
6. Panel "vacunas y desparasitación vencidas" con envío de aviso en un clic.
7. Importador de datos desde otros sistemas (baja el miedo a migrar).

**Después**
8. WhatsApp para recordatorios; reportes; resumen con IA antes de la cita.
9. Facturación electrónica (proveedor externo) e inventario.
10. Documentos imprimibles con QR verificable; urgencias 24 h con código temporal del dueño; referidos entre clínicas.
11. Datos agregados y anonimizados (vacunación, brotes), con cuidado legal.

---

## 15. Glosario

- **B2C / B2B:** negocio hacia consumidores / hacia empresas.
- **SaaS:** software por suscripción en la nube.
- **Historia clínica:** registro de lo que le ha pasado a la mascota (visitas, tratamientos, vacunas, cirugías, laboratorios, peso).
- **Línea de vida (vacunas):** vista cronológica de dosis aplicadas, pendientes y retrasadas.
- **Consentimiento / revocar:** el dueño autoriza a una clínica a ver una mascota y puede quitar la autorización.
- **Paciente:** mascota que un dueño compartió con una clínica.
- **Verificación:** proceso para confirmar que una clínica y sus veterinarios son quienes dicen ser.
- **COMVEZCOL:** registro oficial de profesionales veterinarios en Colombia (referencia de la verificación).
- **RUT, NIT, Cámara de Comercio:** documentos y datos tributarios y legales de una empresa en Colombia.
- **Tarjeta profesional:** licencia que habilita a un veterinario a ejercer.
- **Gateway:** la puerta única que recibe las peticiones y las manda al servicio correcto.
- **Microservicio:** programa pequeño y independiente responsable de una sola parte del sistema.
- **Efecto red:** el valor crece a medida que se suman más usuarios.
- **Freemium:** gratis con un plan de pago opcional.
- **Supuesto:** cifra o afirmación aún no comprobada con datos reales.

---

## Documentos relacionados

- `MYANIMALOG_VET_MAESTRO.md` — plan técnico completo del ecosistema.
- `MYANIMALOG_VET_NEGOCIO.md` — negocio, planes, entrevistas y presentación.
- `MYANIMALOG_VET_CLIENTE.md` — el lado del dueño frente a la clínica.
- `MYANIMALOG_VET_DISENO.md` — guía visual del panel.
- `MYANIMALOG_VET_ESTADO.md`, `MYANIMALOG_VET_BRECHAS.md` — estado y brechas.
- `DATOS_MASCOTA_CLINICA.md` — alergias, esterilización y desparasitación.
- `IA_CHAT_CONTRATO.md` — contrato del asistente de IA.
