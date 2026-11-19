export type AccionAuditoria = 'CREAR' | 'EDITAR' | 'ANULAR' | 'ELIMINAR';
export type EntidadAuditoria = 'VENTA' | 'CLIENTE';

/** One audit log entry (GET /auditoria, GET /ventas/{id}/historial). */
export interface Auditoria {
  id: number;
  fecha: string;
  usuarioId: number | null;
  usuarioNombre: string;
  usuarioRol: string | null;
  accion: AccionAuditoria;
  entidad: EntidadAuditoria;
  entidadId: number | null;
  /** Human-readable summary written by the backend (what changed, the reason…). */
  detalle: string | null;
  datosAntes: unknown;
  datosDespues: unknown;
}

export const ACCIONES: { value: AccionAuditoria; label: string; icon: string }[] = [
  { value: 'CREAR', label: 'Creó', icon: 'solar:add-circle-line-duotone' },
  { value: 'EDITAR', label: 'Editó', icon: 'solar:pen-new-square-line-duotone' },
  { value: 'ANULAR', label: 'Anuló', icon: 'solar:close-circle-line-duotone' },
  { value: 'ELIMINAR', label: 'Eliminó', icon: 'solar:trash-bin-trash-line-duotone' },
];

export const ENTIDADES: { value: EntidadAuditoria; label: string }[] = [
  { value: 'VENTA', label: 'Ventas' },
  { value: 'CLIENTE', label: 'Clientes' },
];

export function accionLabel(a: string): string {
  return ACCIONES.find((x) => x.value === a)?.label ?? a;
}

export function accionIcon(a: string): string {
  return ACCIONES.find((x) => x.value === a)?.icon ?? 'solar:document-line-duotone';
}
