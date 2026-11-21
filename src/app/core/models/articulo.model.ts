import { API_URL } from '../api.config';

export interface UnidadMedida {
  id: number;
  nombre: string;
  plural: string;
}

export interface Proveedor {
  id: number;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

/** IVA rate of an article: 10 %, 5 % or 0 (exempt). */
export type TasaIva = 10 | 5 | 0;

export const TASAS_IVA: { value: TasaIva; label: string; corto: string }[] = [
  { value: 10, label: 'IVA 10 %', corto: '10 %' },
  { value: 5, label: 'IVA 5 %', corto: '5 %' },
  { value: 0, label: 'Exenta', corto: 'Exenta' },
];

export function tasaLabel(t: number | null | undefined): string {
  return TASAS_IVA.find((x) => x.value === t)?.corto ?? '—';
}

/** IVA already included in a price (Paraguay): price ÷ 11 at 10 %, ÷ 21 at 5 %. */
export function ivaIncluido(precio: number, tasa: number): number {
  if (tasa === 10) return Math.round(precio / 11);
  if (tasa === 5) return Math.round(precio / 21);
  return 0;
}

/** Article as returned by GET /sysfact/articulos. */
export interface Articulo {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  tasaIva: TasaIva;
  unidadMedida: UnidadMedida;
  proveedor: Proveedor;
  nombreImagen: string | null;
  /** Units in stock now (changes through goods received, adjustments and sales). */
  existencia: number;
  /** At or below this the article is low on stock; 0 = only when it runs out. */
  stockMinimo: number;
}

/** sin: nothing left (or negative); poco: at or below the minimum; ok: enough. */
export type EstadoStock = 'sin' | 'poco' | 'ok';

export function estadoStock(a: Pick<Articulo, 'existencia' | 'stockMinimo'>): EstadoStock {
  const e = a.existencia ?? 0;
  if (e <= 0) return 'sin';
  if (e <= (a.stockMinimo ?? 0)) return 'poco';
  return 'ok';
}

/** "3 macetas", "1 maceta", "-2 macetas", in the article's unit. */
export function cantidadConUnidad(n: number, um: UnidadMedida | null | undefined): string {
  const unidad = um ? (Math.abs(n) === 1 ? um.nombre : um.plural || um.nombre) : '';
  return `${n.toLocaleString('es-PY')} ${unidad.toLocaleLowerCase('es')}`.trim();
}

export type TipoMovimiento = 'INICIAL' | 'INGRESO' | 'AJUSTE' | 'VENTA' | 'DEVOLUCION';

/** One change to an article's stock (GET /articulos/{id}/stock). */
export interface MovimientoStock {
  id: number;
  fecha: string;
  articuloId: number;
  tipo: TipoMovimiento;
  /** + in, - out. */
  cantidad: number;
  /** Stock right after this movement. */
  existencia: number;
  usuarioNombre: string;
  ventaId: number | null;
  proveedor: { id: number; nombre: string } | null;
  motivo: string | null;
}

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { label: string; icon: string }> = {
  INICIAL: { label: 'Saldo inicial', icon: 'solar:flag-line-duotone' },
  INGRESO: { label: 'Ingreso', icon: 'solar:box-minimalistic-line-duotone' },
  AJUSTE: { label: 'Ajuste', icon: 'solar:tuning-2-line-duotone' },
  VENTA: { label: 'Venta', icon: 'solar:cart-large-minimalistic-line-duotone' },
  DEVOLUCION: { label: 'Devolución', icon: 'solar:undo-left-round-line-duotone' },
};

/** Photo rules, mirrored from ArticuloImagenService (the backend checks them again). */
export const IMAGEN_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGEN_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * URL of the article's photo, or null. The stored file name goes in the URL, so a new photo is a
 * new URL and the browser never shows a stale cached one.
 */
export function imagenArticuloUrl(a: Pick<Articulo, 'id' | 'nombreImagen'> | null | undefined): string | null {
  return a?.nombreImagen ? `${API_URL}/articulos/${a.id}/imagen?v=${encodeURIComponent(a.nombreImagen)}` : null;
}

/** Body for POST/PUT /sysfact/articulos. */
export interface ArticuloInput {
  nombre: string;
  descripcion: string | null;
  precio: number;
  tasaIva: TasaIva;
  unidadMedida: { id: number };
  proveedor: { id: number };
  nombreImagen?: string | null;
  stockMinimo?: number;
}
