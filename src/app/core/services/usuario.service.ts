import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Rol } from '../auth/auth.models';
import { Usuario, UsuarioInput } from '../models/usuario.model';

/** Users and roles (both Administrador-only in the backend). */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/usuarios`;

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.url);
  }

  roles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${API_URL}/roles`);
  }

  crear(body: UsuarioInput): Observable<Usuario> {
    return this.http.post<Usuario>(this.url, body);
  }

  actualizar(id: number, body: UsuarioInput): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.url}/${id}`, body);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
