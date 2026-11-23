/**
 * Fixed roles and what each one may do. They mirror WebSecurityConfig in the backend, which is the
 * one that really enforces them; here they only decide what the screens show.
 */
export const ROL_ADMIN = 'Administrador';
export const ROL_CARGADOR = 'Cargador';
export const ROL_CAJERO = 'Cajero';

/** Create, edit and cancel sales. */
export const ROLES_VENTAS = [ROL_ADMIN, ROL_CAJERO];
/** Register new clients. */
export const ROLES_ALTA_CLIENTES = [ROL_ADMIN, ROL_CAJERO];
/** Pages with catalog data a cashier does not need (suppliers, units, parameters). */
export const ROLES_CATALOGO = [ROL_ADMIN, ROL_CARGADOR];
/** Register goods received. Correcting the count (adjustments) is only for the Administrador. */
export const ROLES_INGRESO_STOCK = [ROL_ADMIN, ROL_CARGADOR];
/** Accounts receivable: see what is owed and register payments of credit sales. */
export const ROLES_COBROS = [ROL_ADMIN, ROL_CAJERO];
/** Daily cash count and closing (a cashier only today's; the Administrador any day). */
export const ROLES_CAJA = [ROL_ADMIN, ROL_CAJERO];

export function puedeVender(rol: string): boolean {
  return ROLES_VENTAS.includes(rol);
}
