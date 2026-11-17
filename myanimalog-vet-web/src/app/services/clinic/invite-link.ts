/**
 * Cómo la clínica le hace llegar su código al dueño. El enlace abre MyAnimaLog directo en "Vincular clínica"
 * con el código ya escrito (si no tiene sesión o cuenta, la app lo recuerda hasta que entre).
 * No se usa el `inviteLink` del backend: hoy apunta a `localhost:8082`.
 */

export function inviteUrl(appBaseUrl: string, code: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}/vet/link?code=${encodeURIComponent(code)}`;
}

export function inviteMessage(clinicName: string, code: string, url: string): string {
  return (
    `Hola, te comparto el código de ${clinicName} para vincularte en MyAnimaLog: ${code}\n\n` +
    `Ábrelo aquí y quedas listo: ${url}\n\n` +
    `Tú decides qué mascotas compartir con la clínica y puedes quitarle el acceso cuando quieras.`
  );
}

/** WhatsApp sin número: se elige el contacto dentro de WhatsApp. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function mailtoUrl(subject: string, message: string, to = ''): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
