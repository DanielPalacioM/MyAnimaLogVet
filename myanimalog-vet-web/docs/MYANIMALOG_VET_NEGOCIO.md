# MyAnimaLogVet — Resumen de la parte veterinaria

> Recopilación de todo lo trabajado sobre el lado B2B (veterinarias): ventajas frente a GVET, verificación de clínicas, oportunidades, planes y precios, guion de entrevistas y estructura de la presentación.
>
> **Aviso importante:** los precios, límites de almacenamiento, porcentajes de conversión y escenarios de ingresos son **supuestos de trabajo**, no datos validados. Hay que contrastarlos con entrevistas a clínicas y con los costos reales de infraestructura. Lo que dice de GVET viene de información pública consultada, no de un análisis a fondo del producto.

---

## 1. Qué es MyAnimaLogVet

SaaS web que se vende a veterinarias para gestionar su clínica, personal, pacientes, agenda y atención clínica, conectado a la misma información que el dueño tiene en su app (MyAnimaLog, B2C).

**Principio de arquitectura:** Veterinary es dueño de *quién atiende, dónde, cuándo y con permiso de quién*; **nunca guarda historia clínica**. La historia vive en Medical, la mascota en Pets, las cuentas en User, la agenda en Calendar, los mensajes en Notifications y los análisis en IA-service.

### Qué puede hacer una veterinaria

| Área | Capacidades |
|---|---|
| Cuenta y clínica | Registrarse, verificarse, prueba gratis, perfil, logo, ubicación, directorio en la app, código/QR de vinculación |
| Equipo | Invitar empleados por email con rol, cambiar roles, activar/desactivar, transferir propiedad, perfil profesional verificado, horarios y bloqueos |
| Pacientes | Recibir dueños por QR, ver mascotas compartidas, registrar pacientes cuyo dueño no tiene app e invitarlo a reclamarlos, buscar pacientes |
| Agenda | Catálogo de servicios con duración y precio, horario de atención, disponibilidad, confirmar/reprogramar/cancelar, check-in, solicitudes desde la app |
| Atención clínica | Visitas, tratamientos, medicación, vacunas, cirugías, laboratorios, peso, documentos |
| Comunicación | Confirmaciones y recordatorios de citas y vacunas |
| Negocio | Plan, pago, renovación, cancelación; reportes e IA previa a la cita (fases posteriores) |

### Roles y permisos

Cinco roles (`OWNER`, `ADMIN`, `VETERINARIAN`, `ASSISTANT`, `RECEPTIONIST`) más `PLATFORM_ADMIN` para el equipo de MyAnimaLog.

- Escritura clínica (`CLINICAL_WRITE`) y de enfermería (`NURSING_WRITE`) **solo con tarjeta profesional verificada** (`licensed = true`).
- La recepción ve datos básicos (`CLINICAL_READ_BASIC`), no la historia completa.
- Si la clínica no está `ACTIVE`, solo conserva configuración, personal y suscripción: puede prepararse, no atender.
- Si la ruta trae un `veterinaryId` distinto al `vet_id` del token → `403`. Es lo que aísla a una clínica de otra.

---

## 2. Ventajas frente a GVET

### Qué es GVET
Sistema de gestión veterinaria en la nube: clientes, historia clínica, archivos, facturas, stock y métricas. Tiene app móvil **gratuita para clientes** y facturación electrónica integrada en Argentina (AFIP) y Chile (SII). Es un producto maduro con buenas reseñas.

> **Corrección importante:** la app para el cliente **no** es un diferencial, porque GVET ya la tiene. Lo diferencial es que la historia pertenece al dueño y viaja entre clínicas, más la verificación de licencias.

### Ventajas que se ven en el diseño

1. **Historia de la mascota, no de la clínica.** El dueño la comparte con cada clínica mediante consentimiento revocable. Si cambia de clínica, la historia lo sigue. No encontré indicios de que GVET ofrezca historial portable entre clínicas.
2. **Verificación de clínicas y profesionales** (ver sección 3). No encontré indicios de que GVET verifique licencias. *Es ausencia de evidencia, no prueba: verifícalo antes de afirmarlo en público.*
3. **Permisos ligados a la licencia real.** Un veterinario sin tarjeta verificada no puede escribir historia clínica.
4. **Pacientes sin app.** La clínica registra la mascota y el dueño la reclama después por correo; la clínica conserva el acceso. Cada clínica trae usuarios a la app.
5. **Agenda con reserva online.** El dueño ve disponibilidad y solicita cita; la base de datos impide la doble reserva del mismo veterinario; el precio y la duración del servicio se copian a la cita; recordatorios a 24 h.
6. **Notificaciones robustas.** Email y push, idempotencia por `messageId`, dead-letter queue, plantillas por evento. WhatsApp como función de plan superior.
7. **IA como apoyo.** Resumen clínico antes de la cita (fase posterior), siempre como apoyo al veterinario.
8. **Seguridad.** JWT RS256 con JWKS, aislamiento estricto entre clínicas, refresh con rotación y detección de reuso, cambios de rol aplicados en máximo 15 min, privacidad de datos sensibles.
9. **Enfoque en Colombia.** COMVEZCOL, NIT con dígito de verificación (algoritmo DIAN), zona horaria `America/Bogota`, prueba de 30 días.

### Dónde GVET probablemente va adelante

- Inventario y control de stock.
- Facturación (para Colombia/DIAN no encontré información sobre GVET; en el plan propio se plantea integrar un proveedor como Alegra o Siigo en una fase posterior).
- Madurez, soporte y reseñas.

### Contexto de mercado
En Colombia el software veterinario cuesta aproximadamente **$70.000 a $300.000 COP al mes**. Competidores: GVET, Okvet, QVET, VeteSoft, Pegazoo, ACVet. Según un estudio de Pet Industry Academy citado en el documento maestro, el 80% de los centros usa software y el 43% considera cambiarlo.

---

## 3. Verificación de clínicas y profesionales

**Decisión: híbrido.** La IA pre-analiza los documentos; una persona decide después de confirmar en el registro oficial.

### Por qué híbrido
- **No solo IA:** puede leer un documento editado y extraer datos coherentes, pero no sabe si la tarjeta es real. Eso solo lo confirma el registro oficial de COMVEZCOL. Aprobar a quien firmará historias clínicas no se delega a un modelo.
- **No solo manual:** a mano se escapan inconsistencias (NIT distinto entre RUT y Cámara de Comercio, nombres que no coinciden). La IA las detecta en segundos.

### Flujo

1. La clínica se registra y queda en `PENDING_DOCUMENTS` (puede configurar e invitar personal, no atender).
2. Sube documentos de la clínica: **RUT, Cámara de Comercio, cédula del representante legal**. Cada veterinario sube su **tarjeta profesional y cédula**; la licencia es de la persona y se verifica una vez aunque trabaje en varias clínicas.
3. Al enviar, la IA analiza en segundo plano y entrega nivel de riesgo y resumen.
4. Un `PLATFORM_ADMIN` revisa los documentos (URLs firmadas de 10 min), el reporte de la IA y consulta el portal de COMVEZCOL.
5. Decide: **aprobar** (exige marcar `registryChecked = true`; se guarda quién y cuándo), **rechazar** con motivo o **pedir corrección**.
6. Al aprobar: la clínica pasa a `ACTIVE`, inicia la prueba de 30 días y los veterinarios verificados obtienen escritura clínica (`vet_licensed = true` en el siguiente refresh, máximo 15 min).

### Qué revisa la IA

| Check | Qué valida |
|---|---|
| `TYPE_MATCHES` | El archivo es del tipo declarado |
| `LEGIBLE` | Legible, completo, no recortado |
| `NIT_MATCHES_DECLARED` | NIT del RUT = NIT declarado (con dígito de verificación) |
| `LEGAL_NAME_MATCHES_ACROSS_DOCUMENTS` | Razón social igual en RUT y Cámara |
| `LEGAL_REP_MATCHES_ID_DOCUMENT` | Representante legal = cédula |
| `CHAMBER_CERT_RECENT` | Certificado de Cámara reciente (umbral configurable) |
| `RUT_ACTIVITY_IS_VETERINARY` | Actividad económica veterinaria |
| `PROFESSIONAL_NAME_MATCHES_ID` | Nombre de tarjeta = cédula |
| `LICENSE_NUMBER_MATCHES_DECLARED` | Número de tarjeta = declarado |
| `VISUAL_TAMPERING_SIGNALS` | Señales de edición; solo genera `WARN`, nunca conclusión |

- Nivel de riesgo: `LOW`, `MEDIUM`, `HIGH`.
- Recomendación: solo `READY_FOR_HUMAN_REVIEW` o `NEEDS_ATTENTION`. **No existen `APPROVE` ni `REJECT`.**
- Si la IA falla o tarda más de 60 s → `ai_status = FAILED`; la revisión humana sigue igual.

### Protecciones adicionales
- Alerta si el mismo archivo (sha256) aparece en clínicas distintas.
- Documentos en bucket privado, nunca URLs públicas; la IA no los guarda, no los usa para entrenar y no los escribe en logs.
- Documentos de solicitudes rechazadas se borran a los 90 días.
- Un usuario puede ser `OWNER` de máximo 3 clínicas en estado no final (anti-spam).
- Si el veterinario cambia su número de tarjeta, vuelve a `NOT_SUBMITTED`.
- El aviso de tratamiento de datos debe mencionar el análisis con IA.
- No se automatiza la consulta a COMVEZCOL: no hay API pública conocida y el scraping es frágil y probablemente contrario a sus términos.

### ¿Es una ventaja frente a GVET?
**Sí, pero con matices.**

- **A favor:** no encontré que GVET la ofrezca; es difícil de copiar rápido (flujo de revisión + equipo + integración con permisos); tiene sentido porque la historia viaja entre clínicas y todos necesitan confiar en quién escribió cada registro.
- **En contra / matices:** quien paga es la clínica y para ella es fricción; el beneficio lo percibe más el dueño; no es exclusivo (Recorvet también restringe el registro clínico a veterinarios con tarjeta válida); escala mal porque cada verificación pasa por una persona; su valor depende del efecto red.
- **Conclusión:** es el diferencial de **confianza y marca**, no la ventaja funcional principal. Funciona como parte del argumento completo: historia portable + clínicas verificadas + dueños sin app que se vuelven usuarios.

### Cómo volverla ventaja comercial
- Posicionarla como respaldo para la clínica, no como trámite.
- Hacerla visible al dueño: sello en el directorio, en la reserva y en cada documento con QR verificable.
- Prometer respuesta en 24–48 h y dejar configurar mientras esperan.
- Usarla como filtro de calidad del directorio.

### Riesgos
- El paso manual en COMVEZCOL no escala si crecen rápido.
- Un documento falsificado muy bien hecho pasa la IA; lo que lo atrapa es la consulta oficial. Ese paso no puede volverse un clic automático.
- Un admin apurado podría confiarse del riesgo `LOW`: la interfaz debe obligar a ver los documentos y a marcar la verificación oficial.

---

## 4. Dolores de la clínica y oportunidades

*(Validar con entrevistas; los dolores salen del documento maestro y de lectura del sector.)*

| Dolor | Ya en el plan | Oportunidad |
|---|---|---|
| Inasistencias | Recordatorio a 24 h, estado `NO_SHOW` | Confirmar/cancelar con un toque, lista de espera automática, abono por Wompi en citas de alto costo, historial de inasistencias por dueño |
| Conseguir clientes | Directorio y reserva online | Perfil público con reseñas verificadas (solo de citas completadas) y sello de verificada |
| Miedo a migrar | Importación como fase posterior | Subirla de prioridad: importador desde GVET, Okvet y Excel; migración asistida |
| Paciente nuevo sin historia | `clinical-summary` y resumen con IA | Argumento de venta principal; medir "minutos ahorrados en la primera consulta" |
| Pacientes que no vuelven | `VACCINE_DUE_REMINDER` | Panel "vacunas vencidas" con envío en un clic |
| Riesgo legal | Auditoría clínica, licencia obligatoria | Documentos imprimibles (fórmula, carnet, certificados) con firma y QR verificable |
| Dueños sin app | Registro de paciente y reclamo | Medir cuántos dueños llegan a la app por cada clínica |

### Más allá
1. **WhatsApp antes de lo planeado:** en Colombia las clínicas viven en WhatsApp; puede ser gancho de venta.
2. **Facturación electrónica:** coexistir con su facturador al inicio y luego integrar Alegra/Siigo.
3. **Urgencias 24 h:** código temporal del dueño para que una clínica no vinculada vea la historia en emergencia.
4. **Referidos entre clínicas** con historia adjunta y permiso del dueño.
5. **Datos agregados y anonimizados** (vacunación, brotes), a largo plazo y con cuidado de la Ley 1581.
6. **Plan FREE como estrategia:** con precios de mercado bajos, traer pacientes y dueños a la app puede valer más que cobrar barato.

### Riesgos del negocio
- **Efecto red:** la portabilidad solo vale con muchos dueños y varias clínicas; al inicio es más promesa que prueba.
- **Brechas básicas:** sin caja, inventario o facturación, una clínica grande no te adopta como sistema principal. Definir primero el segmento (consultorios pequeños y clínicas nuevas).
- **Verificación manual** no escala sin medir tiempos.

### Priorización sugerida
1. Alto impacto, poco esfuerzo: recordatorios con confirmación, panel de vacunas vencidas, resumen previo a la cita.
2. Para adquirir: importador de datos, sello de verificada en el directorio.
3. Para retener: documentos con QR verificable, WhatsApp, integración de facturación.

---

## 5. Planes y precios para la clínica (supuestos)

### Ancla
Mercado en Colombia: $70.000–$300.000 COP/mes. Entrar en la parte media y diferenciarse por historia portable y verificación, no por ser el más barato.

### Planes (los de la presentación)

| | **FREE** | **BASIC** | **PRO** |
|---|---|---|---|
| Precio/mes (COP) | $0 | ~$120.000 | ~$220.000 |
| Usuarios | 1 | 5 | Ilimitados |
| Pacientes | 100 | 1.000 | Ilimitados |
| Almacenamiento | 1 GB | 10 GB | 50 GB |
| Citas en línea | — | Sí | Sí |
| WhatsApp, reportes, resumen con IA | — | — | Sí |
| Sello de clínica verificada | Sí | Sí | Sí |

**Reglas:**
- **Prueba de 30 días** del plan PRO completo para cada clínica aprobada; si no paga, baja a FREE.
- **El sello de verificada va en todos los planes y no se vende.** Si se pudiera comprar, el directorio perdería credibilidad. Si algún día se vende visibilidad destacada, que sea claramente "patrocinado" y solo para clínicas ya verificadas.
- **Los archivos que sube la clínica cuentan contra su espacio**, no contra el del dueño. El plan técnico ya registra qué clínica subió cada documento (`uploaded_by_veterinary_id`).
- Los documentos de verificación no cuentan contra ninguna cuota.
- Aviso al 80% de la cuota; nunca borrar datos por falta de pago.
- Descuento anual (por ejemplo, dos meses gratis) para mejorar el flujo de caja.
- Servicio de importación asistida de datos (pago único o gratis en plan anual).
- Abono por Wompi en citas con comisión pequeña.

> Nota: en el chat se propuso inicialmente FREE/PRO/CLÍNICA; la presentación usa FREE/BASIC/PRO, y el PRO de la presentación equivale al plan "CLÍNICA" propuesto.

### Cómo se relaciona con el dueño (resumen)
- App del dueño **gratis**: 5 mascotas incluidas, ~300 MB, historia completa, compartir y revocar siempre gratis.
- **Premium ~$12.900/mes:** IA, ~5 GB, prueba gratis antes de pagar.
- **Mascota extra:** $5.000/mes desde la sexta.
- Regla de confianza: nunca se cobra por ver la historia ni por compartirla; si deja de pagar, conserva acceso de lectura.
- Un reclamo de mascota registrada por una clínica **nunca se bloquea**, aunque supere las 5 mascotas.

### Escenario optimista al mes 12 (supuestos)

| Fuente | Cálculo | Mensual |
|---|---|---|
| Clínicas | 25 en un plan medio ($120.000) + 11 en el alto ($220.000) | ≈ $5,4 millones |
| Premium de dueños | 9.000 × 4% × $12.900 | ≈ $4,6 millones |
| Mascotas extra | 9.000 × 1,5% con ~2 extras × $5.000 | ≈ $1,35 millones |
| **Total** | | **≈ $11 millones COP/mes** |

Supuestos: 60 clínicas (60% pagan, 24 en FREE), 150 dueños activos por clínica. Con conversión de dueños del 2% en vez de 4%, el ingreso de dueños baja a la mitad. **La conversión del dueño es la cifra más incierta**; medirla en el piloto. En el año 1 acumulado el ingreso sería bastante menor a 12 veces el valor del mes 12, porque el crecimiento es gradual.

### Costos a considerar (sin cifras confirmadas)
Infraestructura (Cloud Run, Supabase, Pub/Sub), IA (por verificación y por uso del dueño), comisión de Wompi, WhatsApp por conversación (por eso solo en planes pagos), **revisión manual de verificaciones** (probablemente el costo más real), soporte e implementación. Punto de equilibrio: calcularlo con costos reales; a modo de ejemplo, con $2 millones de costos fijos mensuales harían falta unas 15–17 clínicas en el plan medio.

---

## 6. Guion de entrevista para veterinarios (20–25 min)

**Objetivo:** saber si la verificación de licencias es un valor real y si aceptarían el trámite. Hablar poco, no presentar la idea hasta la parte 4.

**1. Contexto (3 min)**
1. ¿Cuántas personas trabajan en la clínica y qué roles tienen?
2. ¿Qué software usan hoy (GVET, Okvet, Excel, papel)? ¿Cuánto pagan al mes?
3. ¿Hace cuánto lo usan y qué les gusta o molesta más?

**2. Dolores del día a día (7 min)**
4. Cuéntame la última vez que un paciente llegó sin historia previa. ¿Qué hicieron?
5. ¿Cuántas citas se pierden por inasistencia en una semana normal? ¿Qué hacen?
6. ¿Cómo recuerdan a los clientes las vacunas y controles? ¿Usan WhatsApp?
7. ¿Cómo consiguen clientes nuevos hoy?
8. ¿Han pensado en cambiar de software? ¿Qué los frenó o qué los haría cambiar?
9. ¿Qué no puede faltar para adoptar un sistema (facturación electrónica, inventario, etc.)?

**3. Confianza y licencias (6 min)**
10. ¿Ha visto casos de personas atendiendo sin tarjeta profesional o clínicas informales? ¿Qué impacto tuvo?
11. Cuando recibe un paciente de otra clínica, ¿confía en su historia? ¿Por qué?
12. ¿Algún dueño le ha preguntado si usted o su clínica tienen los papeles al día?
13. ¿Qué tan importante es que su competencia esté regulada y verificada? (1 a 5)

**4. Presentación breve (2 min)**
> "Estamos construyendo una plataforma donde la historia de la mascota es del dueño y viaja entre clínicas. Para escribir historia clínica, la clínica y cada veterinario pasan por una verificación: suben RUT, Cámara de Comercio, cédula y tarjeta profesional. Una persona del equipo confirma en COMVEZCOL y la clínica queda con un sello visible."

**5. Reacción a la verificación (5 min)**
14. ¿Qué piensa de esto? ¿Qué es lo primero que le preocupa?
15. ¿Subiría esos documentos a una plataforma? ¿Qué tendría que garantizarle sobre sus datos?
16. ¿Qué tiempo de espera sería aceptable? (mismo día, 24 h, 48 h, una semana)
17. Si pudiera configurar todo mientras espera, sin atender, ¿le sirve?
18. ¿Le serviría un sello de "veterinaria verificada" en un directorio público?
19. Si solo un veterinario verificado pudiera escribir historia clínica, ¿lo vería como ventaja u obstáculo (auxiliares, recepcionistas)?
20. ¿Pagaría más, igual o menos por un sistema que exija esta verificación?

**6. Cierre (2 min)**
21. Si pudiera elegir una sola cosa que le haría cambiar de software, ¿cuál sería?
22. ¿Puedo volver a contactarlo cuando tengamos una versión para probar?

### Cómo leer las respuestas

| Señal | Significa |
|---|---|
| Cuentan casos reales de informalidad o historias poco confiables (P10–11) | El dolor existe y la verificación tiene sentido |
| "Me parece bien" sin recordar ningún caso | Interés de cortesía, valor bajo |
| Se quejan del trámite o la espera (P15–17) | Riesgo de fricción: acortar tiempos y explicar beneficio |
| Valoran el sello para captar clientes (P18) | La ventaja es comercial, no solo de cumplimiento |
| Hablan más de inasistencias, WhatsApp o facturación que de licencias | La verificación es secundaria; priorizar esas funciones |
| Aceptarían pagar más (P20) | Señal fuerte de poder cobrar por la confianza |

**Consejos:** entrevistar 8–10 clínicas variadas (consultorio pequeño, mediana, alguna que use GVET u Okvet); no hacer preguntas guiadas; pedir casos concretos; anotar frases textuales; incluir 3–5 dueños de mascotas con dos preguntas (si les importa que su veterinario esté verificado y si usarían un directorio con sello).

---

## 7. Estructura de la presentación

### Para vender a una veterinaria (7 diapositivas base)
1. **Portada** con una frase: "Tu clínica, verificada y conectada con los dueños".
2. **El problema:** pacientes sin historia, citas perdidas, pocos clientes nuevos.
3. **La idea:** esquema dueño ↔ mascota ↔ clínicas, con la historia viajando.
4. **Qué gana la clínica:** equipo con roles, agenda con recordatorios, historia con trazabilidad, pacientes por QR.
5. **Clínica verificada:** flujo documentos → IA → revisión humana → COMVEZCOL. Es el diferencial.
6. **Seguridad y control del dueño:** consentimiento por mascota, revocable, datos protegidos.
7. **Cómo empezamos:** prueba de 30 días y siguiente paso concreto.

La parte del dueño no tiene diapositiva propia; se cuenta en la 3 y la 6, para que la clínica siga siendo el centro. Si la reunión dura ~15 min, dedicar unos 10–11 a la clínica.

### Para la universidad
La misma base más 2–3 diapositivas (SCAMPER, metodología/arquitectura, modelo de negocio con escenarios).

### En el archivo `.pptx` ajustado
Quedó así el bloque de modelo de negocio:
- **11:** dueño (Gratis, Premium, Mascota extra y regla de confianza).
- **12:** veterinaria (prueba de 30 días, FREE/BASIC/PRO con almacenamiento, sello en todos los planes).
- **13:** cómo se complementan los ingresos (flujo en tres pasos y escenario optimista marcado como supuesto).

### Consejos para vender
- Presentarlo como programa piloto o acceso anticipado: los documentos describen un plan, no un producto con años.
- No afirmar que GVET carece de algo sin comprobarlo; compararse por la propuesta propia.
- Preparar respuesta a las dos objeciones de siempre: "¿y la facturación electrónica?" y "¿y mis datos actuales?". Si aún no está definido, decirlo con honestidad.
- Hacer una demo corta siguiendo el recorrido de la sección 8.
- Ordenar por historia: problema → solución → prueba → cómo empezar.
- En diapositivas de costos: máximo 5 filas por tabla, la palabra "supuestos" bajo cada proyección y un solo gráfico por diapositiva. En la presentación a la veterinaria mostrar solo planes y precios; los costos y escenarios, solo en la de la universidad (con uno conservador y uno optimista).

---

## 8. Guion de demo (criterio de base técnica completa)

1. Ana se registra en la app, crea "Clínica Patitas", sube RUT, Cámara de Comercio, cédula y tarjeta profesional, y envía.
2. La IA deja un reporte; un admin revisa, verifica en el portal oficial y aprueba. Ana recibe el correo y su prueba de 30 días inicia.
3. Ana invita a Luis (veterinario) y a Sofía (recepcionista); ambos aceptan desde su correo. Luis sube su tarjeta y es aprobado.
4. Sofía registra a "Max", cuyo dueño no tiene la app, y le envía invitación para reclamarlo.
5. Carlos (dueño) instala la app, reclama a Max y ve que Clínica Patitas tiene acceso.
6. Otra dueña se vincula con el QR, comparte a su gata y pide cita desde la app. Sofía la confirma.
7. Luis atiende: marca la cita como atendida, registra la visita y aplica una vacuna. Sofía intenta escribir un diagnóstico y recibe 403.
8. Un empleado de otra clínica intenta leer a Max y recibe 403.
9. La dueña revoca el acceso de la clínica; Luis ya no puede leer su historia.
10. Se simula el fin de la prueba: aviso, periodo de gracia y baja a FREE. Ana paga con Wompi sandbox y vuelve a PRO.

---

## 9. Orden de trabajo técnico entre repos

1. **USER-01, USER-02:** JWT RS256 y JWKS (todo depende de esto).
2. **Veterinary fases 0 y 1:** bases (Flyway, paquetes, Testcontainers, eventos) y seguridad.
3. **VET-11 → USER-03, USER-04:** endpoint interno de miembros y token de clínica.
4. **Veterinary fase 2:** clínica, roles y verificación (IA-01 en paralelo).
5. **USER-06 → Veterinary fase 3:** personal e invitaciones.
6. **PETS-01 a PETS-06 → Veterinary fase 4:** pacientes, hasta VET-29 (endpoint de acceso).
7. **Desde VET-29:** MED-01 a MED-07; y Veterinary fase 5 (catálogo y horarios) seguida de CAL-01 a CAL-06.
8. **Veterinary fase 6:** suscripción, al final.

NOTIF-01 a NOTIF-06 avanzan en paralelo desde que existan los primeros eventos.

### Pendientes técnicos por los nuevos planes
- **Límite de mascotas por dueño y medición de almacenamiento** deben implementarse en Pets (hoy no están contemplados en el plan).
- **Cuota de almacenamiento de la clínica** se alinea con el `PlanLimitGuard` previsto (VET-37).
- Si no alcanza el tiempo del MVP, dejarlos como diseño en la presentación.

---

## 10. Pendientes generales

- Nombres del equipo, universidad y correo en la portada y el cierre del `.pptx`.
- Estado real del proyecto (diapositiva de "Dónde estamos y qué sigue").
- Documento SCAMPER, para armar las diapositivas de la universidad.
- Validar precios, límites y conversión con clínicas piloto.
- Medir el costo real de la IA por verificación y por uso del dueño.
- Revisar qué ofrece realmente GVET en facturación para Colombia y si verifica licencias.
- Definir si la mascota extra se cobra por mes o como pago único (se recomienda por mes con algo de almacenamiento extra incluido).
