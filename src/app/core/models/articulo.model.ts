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
}

/** Article as returned by GET /sysfact/articulos. */
export interface Articulo {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  unidadMedida: UnidadMedida;
  proveedor: Proveedor;
  nombreImagen: string | null;
}
