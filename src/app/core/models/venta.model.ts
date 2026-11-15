import { Cliente } from './cliente.model';
import { Articulo } from './articulo.model';

export type CondicionVenta = 'CON' | 'CRE';

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
  fecha: string;
  totalExenta: number;
  totalIva5: number;
  totalIva10: number;
  totalDescuento: number;
  totalFactura: number;
  cliente: Cliente | null;
  usuario: Vendedor | null;
  detallesVenta: DetalleVenta[] | null;
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
