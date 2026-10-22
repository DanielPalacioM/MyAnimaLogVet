import {
  afterNextRender,
  ElementRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { BLOB_COLOR, BLOB_PATHS } from './blob-shapes';
import { ART_BOX, FADE_MS, Scene, ScenePhoto, SCENE_DURATION_MS, SCENES, ShellSide, TAGLINE } from './brand-scenes';

/**
 * Marco de las pantallas de acceso (login y registro): columna de marca + columna de formulario proyectada.
 * La columna de marca rota entre escenas (logo, gatito, perrito, gatito con perrito) con un desvanecimiento.
 * Todo el arte escala con la altura de la ventana (`--s`), igual que el lienzo de 1280 × 832 del diseño.
 * Cambia cada 15 s con un desvanecimiento suave (solo opacidad, sin movimiento, por eso también se muestra
 * con `prefers-reduced-motion`).
 */
@Component({
  selector: 'vet-auth-shell',
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'setScale()' },
})
export class AuthShell {
  /** Lado de la columna de marca: `left` (login) o `right` (registro). */
  readonly side = input<ShellSide>('right');
  /** Milisegundos que dura cada escena. */
  readonly sceneMs = input(SCENE_DURATION_MS);
  /** Sin scroll: el contenido queda fijo (login). */
  readonly fixed = input(false);

  protected readonly scenes = computed<Scene[]>(() => SCENES[this.side()]);
  protected readonly active = signal(0);

  protected readonly box = computed(() => ART_BOX[this.side()]);
  protected readonly tagline = TAGLINE;
  protected readonly blobPaths = BLOB_PATHS;
  protected readonly blobColor = BLOB_COLOR;
  protected readonly fadeMs = FADE_MS;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.setScale();
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const timer = setInterval(() => {
        // Con la pestaña oculta no se cambia: al volver, la escena sigue donde estaba.
        if (document.hidden) return;
        this.active.update((i) => (i + 1) % this.scenes().length);
      }, this.sceneMs());
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  /**
   * Escalas del marco: el lienzo del Figma mide 1280 × 832. El formulario se ajusta al alto (`--k`) y el arte cubre
   * la ventana (`--ka`), de modo que el morado ocupa la misma proporción de ancho que en el diseño.
   */
  protected setScale(): void {
    const h = Math.max(window.innerHeight, 240);
    const style = this.host.nativeElement.style;
    // Formulario: se ajusta al alto de la ventana (para que los botones siempre se vean).
    style.setProperty('--k', String(h / 832));
    style.setProperty('--vh', `${h}px`);
    // Arte: cubre la ventana (alto o ancho, el que pida más), así el morado ocupa la misma proporción que en el Figma.
    style.setProperty('--ka', String(Math.max(h / 832, window.innerWidth / 1280)));
  }

  /** px de diseño del formulario/fotos (se ajustan al alto de la ventana). */
  protected v(n: number): string {
    return `calc(${n} * var(--sf))`;
  }

  /**
   * Las fotos se ajustan al alto de la ventana y se pegan al borde inferior y al lado de la pantalla, como en el
   * Figma (el recorte de abajo queda fuera de pantalla). `top` se calcula desde el borde inferior de la ventana.
   */
  protected photoTop(photo: ScenePhoto): string {
    const box = this.box();
    const viewportBottom = 832 + Math.abs(box.top); // borde inferior de la ventana en coordenadas del arte
    const overhang = photo.y + photo.h - viewportBottom;
    return `calc(var(--vh) - (${box.top}) * var(--s) - ${photo.h - overhang} * var(--sf))`;
  }

  /** El logo se ajusta al alto de la ventana (como las fotos, para no pisarlas); su posición horizontal sigue al arte. */
  protected logoTop(y: number): string {
    return `calc(${y + this.box().top} * var(--sf) - (${this.box().top}) * var(--s))`;
  }

  /** Distancia al borde derecho del arte para las fotos del registro (arte pegado a la derecha). */
  protected photoRight(photo: ScenePhoto): string {
    return `calc(${941 - photo.x - photo.w} * var(--sf) + 110 * var(--s))`;
  }

  /** Convierte px de diseño en una longitud que escala con la ventana. */
  protected u(n: number): string {
    return `calc(${n} * var(--s))`;
  }
}
