import { FormaPago } from './cobro.model';

/** Money that came in on a day: a cash sale or a payment of a credit sale. */
export interface CajaMovimiento {
  tipo: 'VENTA' | 'COBRO';
  /** Sale id (VENTA) or payment id (COBRO). */
  id: number;
  ventaId: number;
  fecha: string;
  cliente: string | null;
  monto: number;
  formaPago: FormaPago;
  referencia: string | null;
  usuarioNombre: string | null;
}

export interface CajaPorForma {
  formaPago: FormaPago;
  ventas: number;
  cobros: number;
  total: number;
  cantidad: number;
}

/** A day's closing: counted cash against the expected (opening float + cash that came in). */
export interface CajaCierre {
  id: number;
  /** yyyy-MM-dd */
  fecha: string;
  fondoInicial: number;
  totalVentas: number;
  totalCobros: number;
  efectivoEsperado: number;
  efectivoContado: number;
  /** Counted minus expected: negative = missing, positive = extra. */
  diferencia: number;
  observacion: string | null;
  creado: string;
  usuarioNombre: string;
  estado: 'VIGENTE' | 'ANULADO';
  anulacionFecha: string | null;
  anulacionUsuarioNombre: string | null;
  anulacionMotivo: string | null;
}

/** GET /caja?fecha=yyyy-MM-dd */
export interface CajaResumen {
  fecha: string;
  movimientos: CajaMovimiento[];
  porForma: CajaPorForma[];
  totalVentas: number;
  totalCobros: number;
  total: number;
  /** Cash (EFECTIVO) that came in, without the opening float. */
  efectivo: number;
  cierre: CajaCierre | null;
  cierresAnulados: CajaCierre[];
}

export interface CierreInput {
  fecha: string;
  fondoInicial: number;
  efectivoContado: number;
  observacion: string | null;
}

/** "Sin diferencia", "Faltan Gs. 5.000", "Sobran Gs. 2.000". */
export function textoDiferencia(d: number, gs: (n: number) => string): string {
  if (d === 0) return 'Sin diferencia';
  return d < 0 ? `Faltan ${gs(-d)}` : `Sobran ${gs(d)}`;
}

/** Today as yyyy-MM-dd in the browser's own calendar. */
export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
