/** Client as returned by GET /sysfact/clientes. */
export interface Cliente {
  id: number;
  nombres: string;
  apellidos: string;
  ciRuc: string;
  email: string | null;
  telefono: string | null;
}

/** The part of a sale the client list needs (GET /sysfact/ventas). */
export interface VentaResumen {
  id: number;
  fecha: string;
  totalFactura: number;
  cliente: Pick<Cliente, 'id'> | null;
}
