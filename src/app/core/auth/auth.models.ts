export interface Rol {
  id: number;
  nombre: string;
  permisos?: string;
}

/** User returned by POST /sysfact/login (field `user`). */
export interface SessionUser {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: Rol;
  token: string;
}

export interface LoginResponse {
  user: SessionUser;
}
