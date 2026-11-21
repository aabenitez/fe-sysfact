export type AccionAuditoria = 'CREAR' | 'EDITAR' | 'ANULAR' | 'ELIMINAR' | 'INGRESO' | 'AJUSTE';
export type EntidadAuditoria = 'VENTA' | 'CLIENTE' | 'UNIDAD_MEDIDA' | 'STOCK';

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
  { value: 'INGRESO', label: 'Ingresó mercadería', icon: 'solar:box-minimalistic-line-duotone' },
  { value: 'AJUSTE', label: 'Ajustó el stock', icon: 'solar:tuning-2-line-duotone' },
];

export const ENTIDADES: { value: EntidadAuditoria; label: string }[] = [
  { value: 'VENTA', label: 'Ventas' },
  { value: 'CLIENTE', label: 'Clientes' },
  { value: 'UNIDAD_MEDIDA', label: 'Unidades de medida' },
  { value: 'STOCK', label: 'Stock' },
];

export function accionLabel(a: string): string {
  return ACCIONES.find((x) => x.value === a)?.label ?? a;
}

export function accionIcon(a: string): string {
  return ACCIONES.find((x) => x.value === a)?.icon ?? 'solar:document-line-duotone';
}
