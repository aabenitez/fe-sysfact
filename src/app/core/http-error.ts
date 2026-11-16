import { HttpErrorResponse } from '@angular/common/http';

/**
 * Human-readable message from a backend error. The backend's ErrorResponse puts business-rule
 * and validation details in `error: string[]` and a generic text in `mensaje`.
 */
export function mensajeError(e: HttpErrorResponse, porDefecto = 'No se pudo completar la operación.'): string {
  if (e.status === 0) return 'No se pudo conectar con el servidor.';
  if (e.status === 403) return 'Tu rol no tiene permiso para esta acción.';
  const detalle: unknown = e.error?.error;
  if ((e.status === 400 || e.status === 409) && Array.isArray(detalle) && detalle.length) {
    // Validation errors list every field; business rules send a single message.
    return detalle.filter((d) => typeof d === 'string' && !d.includes('Exception')).join(' ') || porDefecto;
  }
  return porDefecto;
}
