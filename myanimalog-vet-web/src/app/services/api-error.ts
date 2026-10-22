/** Error de la API (mock hoy, HTTP después). `code` es estable; `message` está pensado para mostrarse al usuario. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.'): string {
  return error instanceof ApiError ? error.message : fallback;
}
