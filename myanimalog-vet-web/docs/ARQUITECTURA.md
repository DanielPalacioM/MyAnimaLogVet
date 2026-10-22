# Arquitectura del panel web

Angular 20 + Angular Material + SCSS. Cada vista es un módulo (`NgModule`) con su propio routing, cargado bajo demanda (lazy).

```
src/app/
├── auth/
│   ├── auth.config.ts          prefijo de la API y endpoints públicos
│   ├── interceptor/auth.interceptor.ts   pasa el token y renueva con refresh ante un 401
│   └── services/token.service.ts         guarda access + refresh token
├── shared/
│   ├── shared.module.ts        módulo que importan las vistas (Common, ReactiveForms, Router, MatIcon + componentes)
│   ├── components/             auth-shell (columna de marca animada), form-field, choice-cards, otp-input,
│   │                           info-note, step-frame, document-card, login-form
│   ├── validators/             NIT (DV de la DIAN), teléfono, documento, tarjeta, archivos
│   └── utils/
├── services/
│   ├── api-error.ts · mock/    errores y datos de prueba compartidos (directorio de cuentas, latencia)
│   ├── login/                  login.service (contrato) · login.mock.service · login.models
│   └── register/               register.service · register.mock.service · registration.store · step-navigator · models/
└── views/
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
