import { Cliente } from './cliente.model';
import { Articulo } from './articulo.model';
import { FormaPago } from './cobro.model';

export type CondicionVenta = 'CON' | 'CRE';
export type EstadoVenta = 'EMITIDA' | 'ANULADA';

export interface Vendedor {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
}

/** One invoice line. iva5/iva10/exenta are the amounts the backend computed for that line. */
export interface DetalleVenta {
  id: number;
  cantidad: number;
  precioVenta: number;
  descuento: number;
  exenta: number;
  iva5: number;
  iva10: number;
  articulo: Pick<Articulo, 'id' | 'nombre'> & Partial<Articulo>;
}

/** Sale as returned by GET /sysfact/ventas and /ventas/{id}. */
export interface Venta {
  id: number;
  condicionVenta: CondicionVenta;
  /** How a cash sale was paid; null for credit sales (paid later through payments). */
  formaPago?: FormaPago | null;
  fecha: string;
  totalExenta: number;
  totalIva5: number;
  totalIva10: number;
  totalDescuento: number;
  totalFactura: number;
  cliente: Cliente | null;
  usuario: Vendedor | null;
  detallesVenta: DetalleVenta[] | null;
  /** Cancelled sales are kept (with their number) and do not count in totals. */
  estado: EstadoVenta;
  anulacionFecha: string | null;
  anulacionUsuario: Pick<Vendedor, 'id' | 'nombres' | 'apellidos'> | null;
  anulacionMotivo: string | null;
  /** Sum of the valid payments (credit sales). */
  cobrado?: number;
  /** What is still owed; always 0 for cash or cancelled sales. */
  saldo?: number;
  /** Credit sales: due date (sale date plus the credit term), as yyyy-MM-dd. */
  vencimiento?: string | null;
}

/** Body for POST /ventas and PUT /ventas/{id}. IVA and totals are computed by the backend. */
export interface VentaInput {
  condicionVenta: CondicionVenta;
  /** Cash sales only. */
  formaPago: FormaPago | null;
  cliente: { id: number } | null;
  detallesVenta: {
    articulo: { id: number };
    cantidad: number;
    precioVenta: number;
    descuento: number;
  }[];
}

export function estaAnulada(v: Pick<Venta, 'estado'> | null | undefined): boolean {
  return v?.estado === 'ANULADA';
}

/** Same calendar day as now, in the browser's time zone. */
export function esDeHoy(fecha: string | null | undefined): boolean {
  if (!fecha) return false;
  const d = new Date(fecha);
  const hoy = new Date();
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
}

export function condicionLabel(c: string | null | undefined): string {
  return c === 'CON' ? 'Contado' : c === 'CRE' ? 'Crédito' : c || '—';
}

export function clienteNombre(v: Pick<Venta, 'cliente'>): string {
  const c = v.cliente;
  return c ? `${(c.nombres ?? '').trim()} ${(c.apellidos ?? '').trim()}`.trim() : 'Sin cliente';
}

export function vendedorNombre(v: Pick<Venta, 'usuario'>): string {
  const u = v.usuario;
  return u ? `${(u.nombres ?? '').trim()} ${(u.apellidos ?? '').trim()}`.trim() : '—';
}

/** Invoice number shown to people, e.g. 7 → "000007". */
export function numeroFactura(id: number): string {
  return String(id).padStart(6, '0');
}
