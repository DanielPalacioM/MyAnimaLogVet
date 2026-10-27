# Arquitectura del panel web

Angular 20 + Angular Material + SCSS. Cada vista es un módulo (`NgModule`) con su propio routing, cargado bajo demanda (lazy).

```
src/app/
├── auth/
│   ├── guards/auth.guard.ts    protege el panel (sin sesión → /login)
│   ├── auth.config.ts          prefijo de la API y endpoints públicos
│   ├── interceptor/auth.interceptor.ts   pasa el token y renueva con refresh ante un 401
│   └── services/               token.service (access + refresh) · session.service (usuario y clínica)
├── shared/
│   ├── shared.module.ts        módulo que importan las vistas (Common, ReactiveForms, Router, MatIcon + componentes)
│   ├── components/             auth-shell (columna de marca animada), form-field, choice-cards, otp-input,
│   │                           info-note, step-frame, document-card, login-form
│   ├── validators/             NIT (DV de la DIAN), teléfono, documento, tarjeta, archivos
│   └── utils/
├── services/
│   ├── api-error.ts · mock/    errores y datos de prueba compartidos (directorio de cuentas, latencia)
│   ├── login/                  login.service (contrato) · login.mock.service · login.models
│   ├── register/               register.service · register.mock.service · registration.store · step-navigator · models/
│   ├── clinic/                 clinic.store (pacientes, citas, solicitudes de prueba) · models · seed · date.utils
│   ├── home/ agenda/ patients/ estado y datos de cada vista (HomeService, AgendaService, PatientsService)
│   └── panel/                  panel-actions.service (abre los diálogos: nueva cita, agregar paciente, invitar)
└── views/
    ├── panel/     panel.module · panel-routing.module · layout/ (menú lateral) · pages/coming-soon (secciones pendientes)
    ├── home/      Inicio:   home.page.* · home.module · home-routing.module
    ├── agenda/    Agenda:   agenda.page.* · agenda.module · agenda-routing.module
    ├── patients/  Pacientes: patients.page.* · patients.module · patients-routing.module
    ├── login/     login.page.* · login-routing.module.ts · login.module.ts
    └── register/  register.module.ts · register-routing.module.ts
                   ├── layout/   register.layout (marco con la columna de marca)
                   ├── guards/   register-step.guard.ts
                   └── pages/<paso>/  intro, account, verify-email, clinic-data, representative, documents, profile, review, status
                                      (cada una con su .ts, .html y .scss)
```

- Rutas (`app.routes.ts`): `/login` y `/registro`, cada una con `loadChildren` hacia su módulo.
- El interceptor se registra en `app.config.ts` (`provideHttpClient(withInterceptors([...]))`).
- Alias: `@auth/*`, `@shared/*`, `@services/*`, `@views/*`.
- Las páginas se declaran en su módulo con `standalone: false`.

## Registro y animación de la columna de marca

- Pasos de `/registro` (con guard para no saltarse ninguno): `antes-de-empezar` → `cuenta` (1) → `verificar-correo` → `clinica` (2) → `representante` (3) → `documentos` (4) → `perfil` (5) → `revisar` (6) → `estado` (En revisión, 24 a 48 h). Referencias: `docs/MYANIMALOG_VET_REGISTRO.md` y los frames de Figma `1861:19`…`1911:109`.
- `vet-auth-shell` (login y registro) rota entre 4 escenas con desvanecimiento: gatito → logo → perrito → gatito y perrito (en el login: perrito → logo → gatito → ambos; la primera escena es la composición del Figma). Cada escena tiene sus propias manchas naranjas (formas, tamaños y giros distintos; `brand-scenes.ts` y `blob-shapes.ts`).
- Duración de cada escena: `SCENE_DURATION_MS` (15 s) en `brand-scenes.ts`; duración del desvanecimiento: `FADE_MS`. Con la pestaña oculta no cambia.
- Datos de prueba del mock: `ana@patitas.co` / `Patitas2026` (clínica activa), `maria@huellas.co` / `Huellas2026` (clínica en revisión), `nueva@correo.com` / `Segura2026` (sin clínica). Verificación de correo: cualquier código de 6 dígitos salvo `000000`. Ya existen: clínica `Clínica Patitas`, NIT `900123456`, correo `clinica@patitas.co`.
- Fidelidad al Figma: `vet-auth-shell` calcula `--k` = alto de la ventana / 832 y escala con ese mismo factor el arte (mancha morada, logo, fotos, manchas; `--s` = k px) y el formulario (`zoom` sobre `.stage`, en px de diseño). A 1280 × 832 la pantalla coincide con los frames `1828:2`, `1899:73`, `1901:132`, `1902:215`, `1910:20`, `1910:131`, `1910:244` y `1911:109`; en otros tamaños es la misma composición a escala. Comparación hecha por superposición contra capturas del Figma.
- Escenas (`brand-scenes.ts`): la primera de cada lado es la del Figma con sus coordenadas exactas (manchas exportadas del Figma); las demás usan manchas generadas distintas. Coordenadas medidas desde la esquina de la mancha, pegada al borde de la pantalla (izquierda en login, derecha en registro).
- Scroll: el morado y la animación están fijos. La columna blanca (`.content`) se desplaza como una página normal (el título sube y desaparece arriba) y no muestra barra de scroll. El login no necesita desplazarse. El aviso del registro conserva su caja con scroll propio.
- Tipografías: valores del Figma (DISENO §5): títulos 64 (48 en el aviso), etiquetas 16 (20 en login y paso 1), campos 14, ayudas 12, botones 15 (12 en el botón del login).

- Escenas actuales (`brand-scenes.ts`, cambian cada 15 s con desvanecimiento, una a la vez): login = logo con el perrito (imagotipo) → perro (Figma) → perro y gato → gato; registro = gato (Figma) → gato con perro (Figma) → gato con frase. Las manchas del Figma siguen a su foto (`figmaPhoto`). La animación se muestra aunque el sistema pida reducir movimiento (solo cambia la opacidad).

## Panel (Inicio, Agenda, Pacientes, Clientes, Equipo, Servicios y horarios, Mi clínica)

- Rutas protegidas por `authGuard`: `/inicio`, `/agenda`, `/pacientes`, `/clientes`, `/equipo`, `/servicios`, `/mi-clinica` (cada una un módulo lazy bajo `PanelModule`). Reportes y Plan muestran "disponible pronto".
- Datos de prueba en memoria (`ClinicStore`): 249 pacientes (161 perros, 80 gatos, 8 otros), agenda de hoy como el Figma, solicitudes de la app e invitaciones. Se reinician al recargar. Al conectar el backend se reemplaza `ClinicStore` y las vistas no cambian.
- Inicio (`1932:159`): búsqueda → Pacientes, campana, Nueva cita, agenda de hoy, "Por resolver" (Revisar/Avisar/Reenviar), acciones rápidas (diálogos), resumen de la clínica.
- Agenda (`1941:174`): día por profesional (72 px/hora, almuerzo bloqueado, línea de ahora) y semana; calendario, solicitudes (aceptar/rechazar), detalle de la cita con acciones por estado.
- Pacientes (`1958:174`): búsqueda, pestañas por especie, filtros, orden, paginación (9 por página) y ficha.
- La clínica en revisión entra al panel con un aviso; "Ir al panel" del estado y el login con clínica activa llevan a `/inicio`.

### Clientes, Equipo, Servicios y horarios, Mi clínica

- Todo sale de `ClinicStore` (una sola fuente): `members`, `invitations`, `catalog`, `schedule`, `blocks`, `profile`, `linkCode` y los `clients` (dueños con mascotas compartidas, derivados de `patients`). Cada vista tiene su servicio (`services/clients|team|catalog|clinic-profile`).
- Coherencia entre pantallas: el catálogo alimenta "Nueva cita" (solo servicios activos); el horario y los bloqueos cierran horas en ese diálogo (`unavailableReason`); quitar un cliente deja sus mascotas "Por reclamar" en Pacientes; el código de vinculación es el mismo en Clientes, Mi clínica y "Agregar paciente"; las invitaciones del Equipo son las de "Por resolver" en Inicio.
- Clientes (`1964:219`, ficha `1964:905`): búsqueda, filtros, orden, paginación, ficha, QR, quitar cliente.
- Equipo (`1965:219`, ficha `1966:219`, invitar `1966:630`): invitar (7 días), reenviar/cancelar, cambiar rol, transferir propiedad, desactivar.
- Servicios y horarios (`1971:225`): catálogo (crear, editar, "En línea", desactivar; con citas no se borra), horario, horarios por profesional, bloqueos.
- Mi clínica (`1972:225`): perfil público con vista previa en vivo, reservas en línea, código/QR (regenerar, revocar) y datos legales.
- Piezas compartidas nuevas: `vet-switch`, `vet-pager`, `vet-qr`, `vet-modal`, `vet-role-picker`, `ConfirmDialog` y los diálogos de servicio, bloqueo, horario y rol. El QR es una representación visual (no QR estándar) hasta conectar el backend.
- Los diálogos de servicio, bloqueo, horario, cambiar rol y confirmación no tienen frame en Figma: usan el marco de los modales del diseño.
