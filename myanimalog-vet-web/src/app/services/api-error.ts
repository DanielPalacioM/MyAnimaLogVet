import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, Observable, catchError, throwError } from 'rxjs';

/** Error de la API. `code` es estable (el del backend); `message` está pensado para mostrarse al usuario. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.'): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Mensajes en español de los códigos que devuelve el backend (`code` en el cuerpo del error). */
const MESSAGES: Record<string, string> = {
  // Sesión y permisos
  UNAUTHENTICATED: 'Tu sesión venció. Inicia sesión de nuevo.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de continuar.',
  CLINIC_CONTEXT_REQUIRED: 'Elige primero con qué clínica vas a trabajar.',
  TENANT_MISMATCH: 'Esa clínica no corresponde a tu sesión. Vuelve a elegirla.',
  NOT_CLINIC_MEMBER: 'Ya no formas parte de esta clínica.',
  INSUFFICIENT_PERMISSION: 'Tu rol no tiene permiso para hacer esto.',
  CLINIC_SUSPENDED: 'La clínica está suspendida: por ahora no puede hacer esto.',
  CLINIC_NOT_ACTIVE: 'La clínica todavía no está aprobada (o ya no está activa).',
  NOT_VETERINARY_OWNER: 'Solo el dueño de la clínica puede hacer esto.',
  PLATFORM_ADMIN_REQUIRED: 'Esta sección es solo para el equipo de MyAnimaLog.',
  // Clínica
  VALIDATION_ERROR: 'Revisa los datos: algo no tiene el formato correcto.',
  VETERINARY_NAME_TAKEN: 'Ya existe una clínica con ese nombre.',
  VETERINARY_EMAIL_TAKEN: 'Ya existe una clínica con ese correo.',
  INVALID_FILE_TYPE: 'El archivo no es del tipo permitido.',
  FILE_TOO_LARGE: 'El archivo pesa demasiado.',
  EXTERNAL_SERVICE_UNAVAILABLE: 'Un servicio no respondió. Inténtalo de nuevo en un momento.',
  NO_ACTIVE_SUBSCRIPTION: 'La clínica no tiene un plan activo.',
  // Registro y verificación de la clínica
  INVALID_NIT: 'El NIT no es válido. Revisa el número y el dígito de verificación.',
  NIT_TAKEN: 'Ese NIT ya está registrado en otra clínica.',
  CONSENT_REQUIRED: 'Falta aceptar la política de datos y los términos.',
  CONSENT_VERSION_OUTDATED: 'Los términos cambiaron. Recarga la página y acéptalos de nuevo.',
  OWNER_CLINIC_LIMIT_REACHED: 'Ya tienes 3 clínicas en proceso. Espera la respuesta de alguna antes de registrar otra.',
  MISSING_REQUIRED_DOCUMENTS: 'Faltan documentos obligatorios o los datos del representante legal.',
  TRUTHFULNESS_DECLARATION_REQUIRED: 'Tienes que confirmar que la información es verdadera.',
  VERIFICATION_LOCKED: 'La solicitud ya está en revisión y no se puede modificar.',
  INVALID_VERIFICATION_STATE: 'La solicitud no está en un estado que permita esto.',
  VERIFICATION_ATTEMPTS_EXHAUSTED: 'Ya usaste los 3 intentos de verificación.',
  DOCUMENT_NOT_IN_CORRECTION: 'Ese documento no estaba entre los que se pidió corregir.',
  DOCUMENT_NOT_FOUND: 'No encontramos ese documento.',
  DOCUMENT_UPLOAD_CONFLICT: 'Otra subida de este documento está en curso. Inténtalo de nuevo en un momento.',
  INVALID_DOCUMENT_TYPE: 'Ese tipo de documento no corresponde a esta solicitud.',
  VERIFICATION_REQUEST_NOT_FOUND: 'No encontramos esa solicitud de verificación.',
  VETERINARY_NOT_FOUND: 'No encontramos esa clínica.',
  VETERINARY_NOT_ACTIVE: 'Esta clínica todavía no está activa.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  LICENSE_NUMBER_TAKEN: 'Ese número de tarjeta profesional ya pertenece a otra persona.',
  PROFESSIONAL_PROFILE_NOT_FOUND: 'Todavía no hay un perfil profesional.',
  // Administración de la plataforma
  REGISTRY_CHECK_REQUIRED: 'Marca que confirmaste los datos en el registro oficial antes de aprobar.',
  CANNOT_REVIEW_OWN_REQUEST: 'No puedes decidir sobre tu propia solicitud.',
  CANNOT_MANAGE_OWN_CLINIC: 'No puedes suspender ni reactivar una clínica donde trabajas.',
  AI_VERIFICATION_DISABLED: 'El análisis automático está desactivado por ahora. La revisión sigue siendo manual.',
  CLINIC_NOT_SUSPENDED: 'Esa clínica no está suspendida.',
  // Equipo e invitaciones
  INVITATION_ALREADY_PENDING: 'Ya hay una invitación vigente para ese correo. Puedes reenviarla.',
  EMPLOYEE_ALREADY_EXISTS: 'Esa persona ya está en tu equipo.',
  INVALID_EMPLOYEE_ROLE: 'Ese rol no se puede asignar.',
  ONLY_OWNER_CAN_MANAGE_ADMINS: 'Solo el dueño de la clínica puede invitar o cambiar administradores.',
  INVITATION_NOT_FOUND: 'No encontramos esa invitación.',
  INVITATION_NOT_PENDING: 'Esa invitación ya no está pendiente.',
  INVITATION_EXPIRED: 'La invitación venció. Pídele a quien te invitó que la reenvíe.',
  INVITATION_EMAIL_MISMATCH: 'La invitación es para otro correo. Cierra sesión y entra con el correo invitado.',
  EMPLOYEE_NOT_FOUND: 'No encontramos a esa persona en la clínica.',
  CANNOT_MODIFY_SELF: 'No puedes cambiarte a ti mismo.',
  CANNOT_MODIFY_OWNER: 'Al dueño de la clínica no lo puede modificar nadie.',
  CANNOT_MODIFY_PEER_ADMIN: 'Un administrador no puede modificar a otro administrador.',
  OWNER_MUST_TRANSFER_OWNERSHIP: 'El dueño tiene que transferir la propiedad antes de salir.',
  OWNERSHIP_TRANSFER_CONFLICT: 'Alguien más cambió la propiedad al mismo tiempo. Inténtalo de nuevo.',
  // Clientes
  INVALID_INVITE_CODE: 'Ese código no existe.',
  USER_NOT_LINKED: 'Esa persona no estaba vinculada.',
  USER_ALREADY_LINKED: 'Ya está vinculada con la clínica.',
};

const BY_STATUS: Record<number, string> = {
  0: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  400: 'Revisa los datos: algo no tiene el formato correcto.',
  401: 'Tu sesión venció. Inicia sesión de nuevo.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontramos lo que buscabas.',
  409: 'Eso ya cambió. Actualiza e inténtalo de nuevo.',
  413: 'El archivo pesa demasiado.',
  503: 'Un servicio no respondió. Inténtalo de nuevo en un momento.',
};

/** Convierte un error HTTP en `ApiError` con un mensaje en español. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    const body = (error.error ?? {}) as { code?: string; message?: string };
    const code = body.code ?? (error.status === 0 ? 'NETWORK_ERROR' : `HTTP_${error.status}`);
    const message = MESSAGES[code] ?? BY_STATUS[error.status] ?? 'Algo salió mal. Inténtalo de nuevo.';
    return new ApiError(code, message, error.status);
  }
  return new ApiError('UNKNOWN', 'Algo salió mal. Inténtalo de nuevo.');
}

/** Operador RxJS: deja pasar los valores y convierte cualquier error en `ApiError`. */
export function mapApiError<T>(): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => source.pipe(catchError((e: unknown) => throwError(() => toApiError(e))));
}
