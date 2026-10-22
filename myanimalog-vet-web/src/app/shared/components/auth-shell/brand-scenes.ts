/**
 * Escenas de la columna de marca (Figma: Login 1828:2, registro 1899:73 y 1901:132).
 * Cada escena es una composición completa (logo + manchas + foto) y la columna pasa de una a otra con un
 * desvanecimiento. La PRIMERA escena de cada lado es la del Figma, con sus coordenadas exactas.
 *
 * Coordenadas en px de diseño del lienzo de 1280 × 832, medidas desde la esquina superior izquierda de la mancha
 * morada ("arte"); el marco las escala con `--s`. El arte va pegado al borde de la pantalla (izquierdo en el
 * login, derecho en el registro), así que la composición se mantiene igual al Figma en cualquier tamaño.
 */
export type ShellSide = 'left' | 'right';

/** Cuánto dura cada escena antes de pasar a la siguiente. */
export const SCENE_DURATION_MS = 15_000;
/** Duración del desvanecimiento entre escenas. */
export const FADE_MS = 2400;

/** Medidas de la mancha morada por lado (Figma: Rectangle 610). */
export const ART_BOX = {
  left: { w: 924.096, h: 1026.01, top: -194.01, wave: '/brand/login-wave.svg' },
  right: { w: 985, h: 1026, top: -192, wave: '/brand/register-wave.svg' },
} as const;

export const TAGLINE = 'Gestiona tus pacientes, simplifica tu día.';

export interface SceneBlob {
  /** Mancha generada (índice en BLOB_PATHS) o imagen exportada del Figma (`src`). */
  shape?: number;
  src?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  /** Imagen interna centrada con la rotación del Figma (las manchas rotadas del Figma). */
  inner?: { w: number; h: number; rotate: number; skew: number };
}

export interface ScenePhoto {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flip?: boolean;
}

export interface Scene {
  id: string;
  /** Logo "MyAnimaLog et" (Jua 80 en el Figma) con el estetoscopio como V de "Vet". Solo en las escenas del Figma. */
  logo?: { x: number; y: number; size: number; /** Imagotipo: el perrito de la marca sobre el nombre (Figma). */ mascot?: boolean };
  /** Frase motivacional, promoción o dato (en vez del logo). */
  phrase?: { text: string; y: number; size: number };
  /** Eslogan bajo "MyAnimaLog" (como en el Figma) o centrado bajo todo el logo. */
  tagline?: 'figma' | 'below';
  blobs: SceneBlob[];
  photo?: ScenePhoto;
  /** Posición de la foto en el Figma: las manchas del Figma se acomodan a la foto actual con la misma relación. */
  figmaPhoto?: { x: number; y: number; w: number; h: number };
}

const B = '/brand';
const blob = (shape: number, x: number, y: number, w: number, h: number, rotate = 0): SceneBlob => ({
  shape, x, y, w, h, rotate,
});
/** Mancha exportada del Figma (rotada o no). */
const fig = (src: string, x: number, y: number, w: number, h: number, inner?: SceneBlob['inner']): SceneBlob => ({
  src: `${B}/${src}`, x, y, w, h, inner,
});

const DOG = `${B}/login-dog.png`;
const CAT = `${B}/register-cat.png`;
const CAT_DOG = `${B}/register-cat-dog.png`;

/** Registro: arte a la derecha. Origen = (339, −192) del Figma. */
const RIGHT: Scene[] = [
  {
    // Figma 1899:73 (gato)
    id: 'cat',
    logo: { x: 284, y: 245, size: 80 },
    blobs: [
      fig('blob-1.svg', 393, 933, 82, 109),
      fig('blob-2.svg', 789, 766, 92, 72),
      fig('blob-3.svg', 648, 446, 156.096, 160.175, { w: 125.373, h: 100.299, rotate: 38.89, skew: 3.2 }),
      fig('blob-4.svg', 337, 606, 96, 97),
      fig('blob-5.svg', 383, 699, 61, 45),
      fig('blob-6.svg', 426, 749, 28, 26),
      fig('blob-7.svg', 440, 412, 70, 39),
    ],
    figmaPhoto: { x: 362, y: 410, w: 519, h: 616 },
    photo: { src: CAT, x: 184, y: 436, w: 530, h: 630 },
  },
  {
    // Figma 1901:132 (gato con perro)
    id: 'cat-dog',
    logo: { x: 284, y: 245, size: 80 },
    blobs: [
      fig('blob-1.svg', 332, 933, 82, 109),
      fig('blob-2.svg', 789, 766, 92, 72),
      fig('blob-3.svg', 797, 495, 156.096, 160.175, { w: 125.373, h: 100.299, rotate: 38.89, skew: 3.2 }),
      fig('blob-4.svg', 440, 575, 96, 97),
      fig('blob-5.svg', 910, 838, 61, 45),
      fig('blob-6.svg', 426, 749, 28, 26),
      fig('blob-7.svg', 565, 460, 70, 39),
    ],
    figmaPhoto: { x: 397, y: 478, w: 544, h: 546 },
    photo: { src: CAT_DOG, x: 383, y: 425, w: 598, h: 599 },
  },
  {
    id: 'gato-frase',
    phrase: { text: 'Hoy es un buen día para cuidar muchas colas felices.', y: 305, size: 34 },
    blobs: [
      blob(3, 330, 520, 150, 130, -15),
      blob(1, 790, 560, 190, 160, 40),
      blob(5, 300, 830, 150, 160, -25),
      blob(6, 760, 930, 150, 110, 5),
      blob(2, 440, 380, 100, 80, 60),
      blob(4, 850, 400, 100, 100, 0),
    ],
    photo: { src: CAT, x: 184, y: 436, w: 530, h: 630 },
  },
];

/** Login: arte a la izquierda. Origen = (0, −194) del Figma. */
const LEFT: Scene[] = [
  {
    id: 'logo',
    logo: { x: 120, y: 660, size: 88, mascot: true },
    tagline: 'figma',
    blobs: [
      blob(6, 44, 761, 202, 161, -20),
      blob(3, 535, 852, 143, 155, 30),
      blob(4, 41, 341, 108, 105, 12),
      blob(0, 528, 204, 183, 149, -35),
      blob(2, 672, 405, 102, 84, 14),
      blob(7, 305, 909, 140, 118, -48),
    ],
  },
  {
    // Figma 1828:2 (perro)
    id: 'dog',
    logo: { x: 73, y: 255, size: 80 },
    tagline: 'figma',
    blobs: [
      fig('login-blob-1.svg', -64, 491, 127, 104.086, { w: 103.055, h: 126.28, rotate: 90.4, skew: -0.07 }),
      fig('login-blob-2.svg', 98, 916, 68.854, 101.188, { w: 100.633, h: 68.149, rotate: 90.4, skew: -0.07 }),
      fig('login-blob-3.svg', 346.53, 847.21, 152.858, 170.039, { w: 130, h: 100.468, rotate: 125.62, skew: -4.22 }),
      fig('login-blob-4.svg', 268, 438, 93.987, 105.264, { w: 104.504, h: 93.256, rotate: 90.4, skew: -0.07 }),
      fig('login-blob-5.svg', 217, 491, 43.502, 66.149, { w: 65.799, h: 43.041, rotate: 90.4, skew: -0.07 }),
      fig('login-blob-6.svg', 185, 534, 25.324, 31.169, { w: 30.964, h: 25.107, rotate: 90.4, skew: -0.07 }),
      fig('login-blob-7.svg', 543.53, 697.25, 45.753, 57.819, { w: 57.449, h: 45.351, rotate: 90.4, skew: -0.07 }),
    ],
    figmaPhoto: { x: 0, y: 495, w: 486, h: 621 },
    photo: { src: DOG, x: 0, y: 426, w: 587, h: 750 },
  },
  {
    id: 'perro-gato-frase',
    phrase: { text: 'Pacientes peludos, equipo tranquilo.', y: 305, size: 34 },
    blobs: [
      blob(4, 569, 455, 174, 140, -18),
      blob(2, 15, 474, 140, 149, 44),
      blob(6, 599, 861, 118, 108, 0),
      blob(0, 600, 640, 120, 100, -40),
      blob(7, 396, 380, 78, 68, 26),
      blob(5, 623, 300, 96, 102, 10),
    ],
    photo: { src: CAT_DOG, x: 35, y: 427, w: 598, h: 599, flip: true },
  },
  {
    id: 'gato-frase',
    phrase: { text: 'Gracias por cuidar a quienes no pueden decir qué les duele.', y: 305, size: 34 },
    blobs: [
      blob(7, 536, 451, 136, 108, 20),
      blob(3, 8, 486, 183, 192, -30),
      blob(1, 572, 769, 155, 121, 35),
      blob(5, 94, 907, 149, 130, 8),
      blob(0, 685, 605, 87, 87, 0),
      blob(6, 503, 317, 96, 74, -22),
    ],
    photo: { src: CAT, x: 98, y: 446, w: 530, h: 630 },
  },
];

/**
 * Acomoda las manchas del Figma a la foto actual (que puede haberse movido o agrandado) conservando la relación
 * que tienen con ella en el diseño. `dx` compensa el corrimiento del morado del registro (44 → 110 px).
 */
function attach(scenes: Scene[], dx: number): Scene[] {
  return scenes.map((scene) => {
    const o = scene.figmaPhoto;
    const p = scene.photo;
    if (!o || !p) return scene;
    const k = p.w / o.w;
    const blobs = scene.blobs.map((b) =>
      b.src
        ? {
            ...b,
            x: p.x + dx + (b.x - o.x) * k,
            y: p.y + (b.y - o.y) * k,
            w: b.w * k,
            h: b.h * k,
            inner: b.inner && { ...b.inner, w: b.inner.w * k, h: b.inner.h * k },
          }
        : b,
    );
    return { ...scene, blobs };
  });
}

export const SCENES: Record<ShellSide, Scene[]> = { left: attach(LEFT, 0), right: attach(RIGHT, -66) };
