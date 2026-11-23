import { Cliente } from './cliente.model';

export type FormaPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE' | 'OTRO';
export type EstadoCobro = 'VIGENTE' | 'ANULADO';

/** A payment received for a credit sale. Mistakes are cancelled (with a reason), never deleted. */
export interface Cobro {
  id: number;
  fecha: string;
  ventaId: number;
  monto: number;
  formaPago: FormaPago;
  referencia: string | null;
  usuarioId: number | null;
  usuarioNombre: string;
  estado: EstadoCobro;
  anulacionFecha: string | null;
  anulacionUsuarioNombre: string | null;
  anulacionMotivo: string | null;
}

/** A credit sale that still has something to pay (GET /cobros/pendientes). */
export interface CuentaPorCobrar {
  ventaId: number;
  fecha: string;
  /** Calendar date, yyyy-MM-dd (no time, so no time zone shifts it). */
  vencimiento: string;
  /** Days past the due date; 0 while not due yet. */
  diasAtraso: number;
  cliente: Cliente | null;
  total: number;
  cobrado: number;
  saldo: number;
  ultimoCobro: string | null;
}

/** Body of POST /ventas/{id}/cobros. */
export interface CobroInput {
  monto: number;
  formaPago: FormaPago;
  referencia: string | null;
}

export const FORMAS_PAGO: { value: FormaPago; label: string; icon: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: 'solar:wad-of-money-line-duotone' },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: 'solar:transfer-horizontal-line-duotone' },
  { value: 'TARJETA', label: 'Tarjeta', icon: 'solar:card-line-duotone' },
  { value: 'CHEQUE', label: 'Cheque', icon: 'solar:document-text-line-duotone' },
  { value: 'OTRO', label: 'Otro', icon: 'solar:menu-dots-circle-line-duotone' },
];

/** Receipt number of a payment: its id, like invoices (5 → "000005"). */
export function numeroRecibo(id: number): string {
  return String(id).padStart(6, '0');
}

export function formaPagoLabel(f: string): string {
  return FORMAS_PAGO.find((x) => x.value === f)?.label ?? f;
}

export function formaPagoIcon(f: string): string {
  return FORMAS_PAGO.find((x) => x.value === f)?.icon ?? 'solar:wallet-money-line-duotone';
}

/** "Vence hoy", "Vence en 3 días", "Vencida hace 12 días". */
export function textoVencimiento(c: Pick<CuentaPorCobrar, 'vencimiento' | 'diasAtraso'>): string {
  if (c.diasAtraso > 0) return `Vencida hace ${c.diasAtraso} ${c.diasAtraso === 1 ? 'día' : 'días'}`;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  // "yyyy-MM-dd" read as a local date: new Date("yyyy-MM-dd") would read it as UTC midnight,
  // which is the day before in Paraguay.
  const [a, m, d] = c.vencimiento.split('-').map(Number);
  const vence = new Date(a, m - 1, d);
  const faltan = Math.round((vence.getTime() - hoy.getTime()) / 86400000);
  if (faltan <= 0) return 'Vence hoy';
  return `Vence en ${faltan} ${faltan === 1 ? 'día' : 'días'}`;
}
