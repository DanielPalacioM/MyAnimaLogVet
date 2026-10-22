# MyAnimaLogVet — Guía de diseño

> Decisiones visuales de la parte veterinaria: paleta, uso del turquesa, tipografía y medidas del registro de clínicas.
> El diseño vive en Figma (archivo `e9FbM805Y2oAmOgIbcL0Hj`, página `Page 1`). Este documento explica **por qué** se ve así y **cómo** aplicarlo.
> Fecha: octubre 2026.

## Índice

1. Dirección visual
2. Paleta
3. El turquesa: cuándo sí y cuándo no
4. Colores de estado
5. Tipografía
6. Medidas y componentes del registro
7. Pantallas del registro en Figma
8. Inicio del panel
9. Reportes
10. Agenda

---

## 1. Dirección visual

La parte Vet debe verse **seria y organizada**: con estilo propio, pero sin ser juguetona ni recargada. Quien la usa es una clínica que confía su operación y sus documentos legales a la plataforma.

- La seriedad sale de la **estructura** (columnas, alineación, jerarquía clara), no de quitarle color.
- Las ilustraciones y fotos (gato, perro, manchas naranjas) van en la columna de marca de la derecha, el login, los estados vacíos y el onboarding. **La zona de trabajo va limpia.**
- **Un solo color de acción:** el morado. Los demás colores tienen una función concreta y no se usan como decoración.

---

## 2. Paleta

Tomada del Login MyAnimaLogVet (`1828:2`).

| Rol | Color | Uso |
|---|---|---|
| Morado de marca | `#4037BE` | Botones principales, enlaces, indicador de paso, barra de progreso |
| Morado claro | `#544CC4` | Parte alta del degradado de la columna de marca |
| Índigo profundo | `#201B61` | Parte baja del degradado y fondos oscuros |
| Morado suave | `#F1F0FB` / `#F7F6FF` | Fondos de notas, opciones seleccionadas y paneles |
| Turquesa de marca | `#00FFDF` | Logo y sello de "verificada". Ver la sección 3. |
| Turquesa clínico | `#00796B` | Texto e íconos turquesa sobre blanco |
| Turquesa suave | `#E0FFFA` | Fondo de chips "Listo" y "Verificado" |
| Naranja | `#F5A623` | Avisos y pendientes. En la marca aparece como `#FEB444`; para la interfaz se usa `#F5A623`, el de la app. |
| Texto | `#000000` / `#1A1A2E` | Títulos y etiquetas |
| Texto secundario | `#404040` | Ayudas y descripciones |
| Bordes | `#000000` (2 px) | Campos, botones secundarios y tarjetas de documento |

**Rojo:** solo para acciones destructivas, como revocar acceso, desvincular o cancelar una cita. Nunca para un botón de acción normal; en una app de salud el rojo significa error o urgencia.

---

## 3. El turquesa: cuándo sí y cuándo no

### Por qué se queda el `#00FFDF`

1. **Contrasta muy bien sobre los fondos de marca.**

   | `#00FFDF` sobre… | Contraste | Resultado |
   |---|---|---|
   | Morado `#4037BE` | 6,6 : 1 | Pasa AA, incluso en texto pequeño |
   | Índigo `#201B61` | ~12 : 1 | Excelente |
   | Blanco `#FFFFFF` | 1,3 : 1 | **Ilegible** |

2. **La familia turquesa se asocia con lo clínico.** Las batas de cirugía son verde azulado porque es el complementario del rojo de la sangre: descansa la vista y reduce la imagen residual.
3. **Armoniza con la paleta.** Morado (~245°), turquesa (~172°) y naranja (~36°) forman casi una tríada. Morado y naranja ya son complementarios; el turquesa entra como tercer color sin competir.

### El límite

El turquesa de las batas es **apagado y medio oscuro** (cercano a `#00796B`). El `#00FFDF` es la versión **neón**: saturación y brillo al máximo. Ese extremo se lee más como tecnología o energía que como clínica. Usado en toda la interfaz, el panel se vería llamativo en vez de serio.

### Reglas de uso

| Uso | Color |
|---|---|
| Logo (el "et" y el estetoscopio) | `#00FFDF`, siempre sobre morado o índigo |
| Sello de "Clínica verificada" o "Aprobada" | `#00FFDF`, como relleno y con el ícono oscuro `#1A1A2E` encima |
| Chips de "Listo" o "Verificado" sobre blanco | Fondo `#E0FFFA` + texto e ícono `#00796B` |
| Texto o íconos turquesa sobre blanco | `#00796B` |
| Botones, fondos grandes, textos sobre blanco | **Nunca** `#00FFDF` |

**Regla práctica:** el turquesa neón significa **"verificado"**. Si aparece poco, pesa más. En el registro aparece una sola vez, en la pantalla "¡Aprobada!".

**Opción si se quiere un logo más sobrio:** `#2DE2C4` baja un poco la saturación y sigue contrastando ~5 : 1 sobre el morado. El estetoscopio del logo es una imagen (`estetoscopio 2`), así que cambiarlo implica volver a exportarla.

---

## 4. Colores de estado

### Documentos del registro

| Estado | Borde | Fondo | Texto / ícono |
|---|---|---|---|
| Pendiente | `#000000` | `#FFFFFF` | Botón "Subir" en `#4037BE` |
| Listo | `#000000` | `#FFFFFF` | Chip `#E0FFFA` + `#00796B` |
| Corregir | `#F5A623` | `#FFF7EA` | Botón "Volver a subir" `#F5A623` |

### Citas (propuesta para la agenda y la app del dueño)

Cada chip lleva también un ícono, para que el estado no dependa solo del color.

| Estado | Texto visible | Color | Fondo |
|---|---|---|---|
| `REQUESTED` | Pendiente de confirmación | `#B26A00` | `#FFF4E0` |
| `CONFIRMED` | Confirmada | `#4037BE` | `#F1F0FB` |
| `CHECKED_IN` | En la clínica | `#00796B` | `#E0FFFA` |
| `COMPLETED` | Atendida | `#2E7D32` | `#E8F5E9` |
| `CANCELLED` | Cancelada | `#6B6B80` | `#F0F0F3` |
| `NO_SHOW` | No asististe | `#3D3D4E` | `#E6E6EB` |
| `REJECTED` | Rechazada | `#B42318` | `#FEF3F2` |

---

## 5. Tipografía

| Uso | Fuente | Tamaño |
|---|---|---|
| Logo "MyAnimaLog" | Jua Regular | 80 |
| Títulos de pantalla | Afacad Bold | 64; baja hasta 40 si el título no cabe en 410 px |
| Etiquetas de campo | Afacad Bold | 16 |
| Texto de botones | Afacad Bold | 15 |
| Subtítulos | Afacad Medium | 15, color `#404040` |
| Ayudas y notas | Afacad Medium | 12–13, color `#404040` |
| Indicador de paso | Afacad Bold | 12, mayúsculas, espaciado 8 %, color `#4037BE` |

En la app móvil del dueño se mantienen Jua (títulos) y Actor (texto).

---

## 6. Medidas y componentes del registro

Pantallas de escritorio de **1280 × 832**. El formulario vive en la columna blanca de la izquierda; la columna de marca (degradado, logo, gato y manchas) queda igual en todas las pantallas.

| Elemento | Medida |
|---|---|
| Eje central del formulario | x = 236 (títulos, subtítulos y textos centrados) |
| Columnas | izquierda x = 45, derecha x = 242, cada una de 184 px (13 px entre ellas) |
| Ancho completo | 381 px (de x = 45 a x = 426) |
| Indicador de paso | texto en y = 34, barra de 381 × 4 en y = 56 |
| Título | y = 98 |
| Subtítulo | y = 172, ancho 320 |
| Contenido | empieza en y ≈ 232–244 |
| Botones Atrás / Continuar | y = 700, uno en cada columna |
| Campo | etiqueta + caja de 41 px de alto, borde negro de 2 px, radio 5 |

**Componentes locales** (frame "Vet · Componentes (registro)", `1908:2`):

| Componente | Id | Propiedades |
|---|---|---|
| `Vet/Campo` | `1908:3` | Etiqueta, Placeholder, Desplegable (muestra la flecha de select) |
| `Vet/Botón` | `1908:13` | Tipo = Principal / Secundario, Texto |
| `Vet/Documento` | `1908:48` | Estado = Pendiente / Listo / Corregir, Título, Ayuda |

**Microcopy:** en español, en segunda persona ("Sube…", "Revisa…"). Las etiquetas van arriba del campo; el placeholder solo da un ejemplo, nunca reemplaza la etiqueta.

---

## 7. Pantallas del registro en Figma

Todas en la fila y = 5875, de izquierda a derecha.

| # | Pantalla | Id | Contenido |
|---|---|---|---|
| — | Antes de empezar | `1861:19` | Aviso de tratamiento de datos (Ley 1581, análisis con IA) y dos casillas obligatorias |
| 1 | Crea tu cuenta | `1899:73` | Nombre, correo y contraseña |
| 2 | Tu clínica | `1901:132` | Nombre comercial, razón social, NIT + DV, teléfono, correo, departamento/ciudad, logo, dirección y mapa |
| 3 | Representante | `1902:215` | "¿Eres tú?", nombre, tipo y número de documento |
| 4 | Documentos | `1910:20` | RUT, Cámara de Comercio, cédula del representante y fachada (opcional) |
| 5 | Tu perfil | `1910:131` | "¿Eres veterinario?", profesión, tarjeta profesional, especialidad, universidad y documentos |
| 6 | Revisa y envía | `1910:244` | Resumen con "Editar", declaración de veracidad y "Enviar a verificación" |
| — | En revisión | `1911:109` | Línea de tiempo y "Mientras esperas puedes…" |
| — | Corrige y reenvía | `1911:198` | Nota del revisor y el documento a corregir |
| — | ¡Aprobada! | `1911:303` | Sello turquesa, "Clínica verificada" y prueba PRO de 30 días |
| — | No aprobada | `1911:368` | Motivo, qué hacer, intentos restantes y borrado a los 90 días |

**Reglas de negocio que el diseño refleja** (ver [MYANIMALOG_VET_MAESTRO.md](MYANIMALOG_VET_MAESTRO.md) §4 y §7.5):

- El reporte de la IA y el nivel de riesgo **nunca** se le muestran a la clínica: solo ve el estado y las notas del revisor.
- Mientras no esté aprobada, la clínica puede configurar horarios, catálogo y equipo, pero no atender ni aparecer en el directorio.
- La prueba de 30 días empieza al aprobarse, no al registrarse.
- Después de un rechazo puede enviar una nueva solicitud, con un máximo de 3 intentos.
- Los datos de ejemplo de las pantallas ("Clínica Patitas", "Ana María Gómez", el NIT) son inventados.

---

## 8. Inicio del panel

Objetivo: que el equipo entienda **cómo viene el día en 5 segundos** sin sentirse abrumado. Prototipo animado del saludo: https://claude.ai/artifact/M4R2ewo2ud2VifhTML7ypx

### Principios

- **Menos opciones a la vista, decisiones más rápidas.** Máximo 5 bloques. Lo demás vive en el menú lateral.
- **Resumen antes que detalle.** El saludo resume el día en chips; el detalle está un clic más abajo.
- **El Inicio cambia según el rol.** Recepción ve agenda y solicitudes; el veterinario, sus pacientes del día; dueño y administrador, además, equipo y plan. Nadie ve lo que no puede usar.
- **Pendientes acotados.** Si hay más de 3, se muestra "Ver todos (7)". Una lista larga genera ansiedad.
- **Calma visual.** Un solo color de acción (morado). Naranja solo para lo que requiere atención.
- **Motivación sin presión.** Frases cálidas, pero que reconocen la carga real: un día con 18 citas no se saluda con "¡qué día tan relajado!".

### Menú lateral

Inicio · Agenda · Pacientes · Clientes · Reportes · Equipo · Servicios y horarios · Mi clínica · Plan. El Asistente IA se agrega cuando exista; no se reserva un espacio vacío para él.

### Bloques

| # | Bloque | Contenido |
|---|---|---|
| 1 | Saludo | Perrito, fecha, saludo, frase y chips: citas de hoy, solicitudes por confirmar, vacunas vencidas |
| 2 | Agenda de hoy | Línea de tiempo con la próxima cita destacada. Es la columna ancha. |
| 3 | Pendientes (máx. 3) | Solicitudes de cita, vacunas vencidas, invitaciones sin aceptar, cada uno con su botón |
| 4 | Acciones rápidas | Nueva cita, registrar paciente, mostrar código QR (para vincular clientes en recepción), invitar compañero |
| 5 | Mi clínica | Días de prueba, espacio usado y sello de verificada. Discreto, abajo a la derecha. |

Una clínica recién aprobada ve, en lugar de la agenda vacía, una lista "Configura tu clínica" (horarios, servicios, equipo, código QR) con su progreso. Una tarea empezada invita a terminarla.

### El saludo

- **Saludo:** "¡Buenos días / Buenas tardes / Buenas noches, equipo {clínica}!" según la hora. Para una clínica recién aprobada: "¡Bienvenidos a MyAnimaLogVet!".
- **Frase, por prioridad:** clínica nueva → día sin citas → día con 15 citas o más → después de las 7 p. m. → lunes → viernes → una frase del banco elegida con la fecha como semilla (no cambia al recargar, sí de un día a otro).
- **Banco de frases:** "Hoy es un buen día para cuidar a muchas colas felices." · "Cada consulta cuenta una historia. Hoy escribimos unas cuantas más." · "Gracias por cuidar a quienes no pueden decir qué les duele." · "Pacientes peludos, equipo tranquilo. Vamos paso a paso." · "Que hoy salgan muchos pacientes moviendo la cola."
- **Chips:** solo los que tienen valor; si no hay solicitudes, ese chip no aparece.

### El perrito animado

- **Hoy:** el logo es un PNG plano, así que en Figma solo se puede mover la imagen completa. La animación se hace en código: la cola se recortó como imagen aparte (pivote en 87,3 % / 88,7 % del lienzo) y el cuerpo se anima completo.
- **Movimiento:** al entrar, un salto, un saludo con la cabeza y la cola moviéndose (una vez por sesión). Después solo mueve la cola cada ~9 s o al pasar el mouse. Un movimiento constante distrae en una herramienta de trabajo.
- **Accesibilidad:** con `prefers-reduced-motion` no hay animación.
- **A futuro:** para que mueva la pata, las orejas o la cola con fluidez, el perrito debe redibujarse por capas (cabeza, orejas, cuerpo, cola, pata levantada) en SVG, o animarse como Lottie. Eso lo hace un ilustrador o una herramienta como Rive o LottieFiles; luego se integra en Angular.

---

## 9. Reportes

Pantalla aparte del Inicio: el Inicio sirve para **operar el día** y Reportes para **medir cómo va la clínica**. Frame en Figma: `1935:182`.

### Contenido, de arriba abajo

| Bloque | Qué responde |
|---|---|
| Periodo (Este mes · 3 meses · 6 meses · Año) y Exportar | Un solo filtro, arriba, que aplica a todo |
| 4 indicadores: citas atendidas, inasistencia, pacientes nuevos, vacunas al día | ¿Cómo vamos? Cada uno con su cambio frente al periodo anterior (flecha + texto, nunca solo color) |
| Hallazgo | Una frase con el problema más importante y una acción ("Los lunes faltan casi el doble… Activar recordatorio") |
| Citas atendidas por mes (barras) | ¿Crecemos? |
| Inasistencia por mes (línea con la meta punteada) | ¿Estamos mejorando en lo que fallamos? |
| ¿Qué días faltan más? (barras horizontales) | ¿Dónde está el problema? Los días sobre la meta van en naranja. |
| Salud de los pacientes | Vacunación al día / por vencer / vencidas, controles posoperatorios y planes de peso |
| Por profesional (tabla) | Citas, inasistencia, cancelaciones y servicio más frecuente de cada veterinario |

### Reglas de las gráficas

- **Una serie por gráfica, en morado `#4037BE`.** Nada de dos ejes en una misma gráfica.
- **Naranja de gráficas: `#C97D00`.** El `#F5A623` de la app es muy claro para barras (contraste 2:1 sobre blanco); `#C97D00` pasa contraste y prueba de daltonismo junto al morado.
- **Estados de salud:** verde `#2E7D32`, naranja `#C97D00`, rojo `#B42318`, siempre con su etiqueta y separados por 2 px, porque el verde y el naranja se confunden con protanopía.
- **Etiquetas selectivas:** solo el último valor lleva número; los ejes y la cuadrícula van en gris suave.
- **En código:** cada gráfica lleva tooltip al pasar el mouse y una vista de tabla.
- **Plan:** según [MYANIMALOG_VET_NEGOCIO.md](MYANIMALOG_VET_NEGOCIO.md), los reportes son del plan PRO. En FREE y BASIC se pueden mostrar los 4 indicadores y dejar el resto con un aviso de "Disponible en PRO".
- Los datos de la pantalla son de ejemplo.

---

## 10. Agenda

Frames: día por profesional `1941:174` y con el detalle abierto `1942:174`.

- **Vista principal: el día con una columna por profesional.** La recepción piensa en "¿quién está libre?", no solo en "¿qué hay a las 10?".
- **Escala:** 72 px por hora, de 8:00 a. m. a 5:00 p. m., con líneas cada 30 min.
- **Bloques de cita:** fondo y borde con el color de su estado (§4). "Por confirmar" lleva **borde punteado** (aún no es firme); "No asistió" va en gris con el nombre tachado; "Atendida" se atenúa; la próxima cita lleva borde morado de 2 px y el chip "Próxima".
- **Horas bloqueadas** (almuerzo, vacaciones, cirugías) con rayado gris: se ve que no hay cupo sin leer.
- **Línea de "ahora"** en rojo `#E5484D`, la convención de los calendarios. Es la única excepción a la regla de rojo solo para acciones destructivas.
- **Panel izquierdo:** mini calendario (puntos en los días con citas), solicitudes de la app con Aceptar/Rechazar y la leyenda de estados.
- **Detalle de la cita:** panel lateral de 400 px, sin salir de la agenda. Mascota, estado, fecha, profesional, servicio y precio, dueño con "Llamar", nota del dueño e historial reciente. Los botones cambian con el estado (Confirmar/Rechazar → Marcar llegada → Atendida y "Registrar visita"); Reprogramar y No asistió como secundarios; "Cancelar cita" en rojo y abajo.
- **En código:** arrastrar una cita la reprograma (el backend revalida la disponibilidad) y hacer clic en un hueco abre "Nueva cita" con esa hora.
- **Pendiente de diseñar:** vista de semana, modal de nueva cita (paciente → servicio → profesional → franja libre) y estados especiales (día sin citas, clínica cerrada, profesional de vacaciones).
