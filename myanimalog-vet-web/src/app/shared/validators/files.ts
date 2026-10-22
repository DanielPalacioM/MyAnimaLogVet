export interface FileRule {
  /** Tipos MIME permitidos. */
  types: readonly string[];
  /** Extensiones permitidas (sin punto), por si el navegador no informa el tipo. */
  extensions: readonly string[];
  maxBytes: number;
  /** Texto para el usuario: "PDF, JPG o PNG". */
  label: string;
}

const MB = 1024 * 1024;

/** Documentos de verificación (REGISTRO §3): PDF, JPEG o PNG, hasta 10 MB. */
export const DOCUMENT_RULE: FileRule = {
  types: ['application/pdf', 'image/jpeg', 'image/png'],
  extensions: ['pdf', 'jpg', 'jpeg', 'png'],
  maxBytes: 10 * MB,
  label: 'PDF, JPG o PNG',
};

/** Logo de la clínica (REGISTRO §2): PNG, JPEG o WEBP, hasta 2 MB. */
export const LOGO_RULE: FileRule = {
  types: ['image/png', 'image/jpeg', 'image/webp'],
  extensions: ['png', 'jpg', 'jpeg', 'webp'],
  maxBytes: 2 * MB,
  label: 'PNG, JPG o WEBP',
};

/** Devuelve el mensaje de error para el usuario, o `null` si el archivo cumple la regla. */
export function validateFile(file: File, rule: FileRule): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const typeOk = file.type ? rule.types.includes(file.type) : rule.extensions.includes(extension);
  if (!typeOk || !rule.extensions.includes(extension)) {
    return `Formato no permitido. Sube un archivo ${rule.label}.`;
  }
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > rule.maxBytes) {
    return `El archivo pesa ${formatSize(file.size)}. El máximo es ${formatSize(rule.maxBytes)}.`;
  }
  return null;
}

export function formatSize(bytes: number): string {
  return bytes >= MB ? `${(bytes / MB).toFixed(1).replace('.0', '')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
