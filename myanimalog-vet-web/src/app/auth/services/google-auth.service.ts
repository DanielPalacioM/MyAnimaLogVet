import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { ApiError } from '@services/api-error';

/** Lo mínimo que usamos de Google Identity Services (https://accounts.google.com/gsi/client). */
interface GoogleId {
  initialize(config: Record<string, unknown>): void;
  prompt(listener?: (notification: GoogleNotification) => void): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  cancel(): void;
}

interface GoogleNotification {
  isNotDisplayed?(): boolean;
  isSkippedMoment?(): boolean;
  isDismissedMoment?(): boolean;
  getDismissedReason?(): string;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/**
 * "Ingresar con Google": pide un `idToken` a Google (selector flotante y, si el navegador no lo muestra,
 * el botón oficial en un contenedor de respaldo). El token se manda a `POST /auth/google` del User service.
 * El origen de la página tiene que estar en los "Orígenes autorizados" del ID de cliente en Google Cloud.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private script?: Promise<GoogleId>;

  readonly configured = !!environment.googleClientId;

  /**
   * Pinta el botón oficial de Google dentro de `host` (la página lo deja invisible encima de nuestro botón,
   * así un solo clic abre la ventana de Google) y emite cada `idToken` que Google entregue.
   */
  idTokens(host: HTMLElement): Observable<string> {
    return new Observable<string>((subscriber) => {
      let active = true;
      if (!this.configured) {
        subscriber.error(new ApiError('GOOGLE_UNAVAILABLE', 'El ingreso con Google todavía no está configurado.'));
        return;
      }
      this.load()
        .then((google) => {
          if (!active) return;
          google.initialize({
            client_id: environment.googleClientId,
            callback: (response: { credential?: string }) => {
              if (!response.credential) {
                subscriber.error(new ApiError('GOOGLE_REJECTED', 'Google no nos entregó tu identidad. Inténtalo de nuevo.'));
                return;
              }
              subscriber.next(response.credential);
            },
            auto_select: false,
          });
          host.replaceChildren();
          google.renderButton(host, { type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', width: 263 });
        })
        .catch(() =>
          subscriber.error(new ApiError('GOOGLE_UNAVAILABLE', 'No pudimos cargar Google. Revisa tu conexión e inténtalo de nuevo.')),
        );
      return () => {
        active = false;
      };
    });
  }

  /** Carga el script de Google una sola vez. */
  private load(): Promise<GoogleId> {
    const ready = window.google?.accounts?.id;
    if (ready) return Promise.resolve(ready);
    this.script ??= new Promise<GoogleId>((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = SCRIPT_SRC;
      tag.async = true;
      tag.onload = () => {
        const google = window.google?.accounts?.id;
        google ? resolve(google) : reject(new Error('GSI'));
      };
      tag.onerror = () => {
        this.script = undefined;
        reject(new Error('GSI'));
      };
      document.head.appendChild(tag);
    });
    return this.script;
  }
}
