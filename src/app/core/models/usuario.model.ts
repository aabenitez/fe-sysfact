import { Rol } from '../auth/auth.models';

/** System user as returned by GET /sysfact/usuarios (the password never comes back). */
export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: Rol;
}

/** Body for POST/PUT /sysfact/usuarios. contrasena: required to create; empty keeps it on edit. */
export interface UsuarioInput {
  nombres: string;
  apellidos: string;
  correo: string;
  rol: { id: number };
  contrasena?: string;
}
