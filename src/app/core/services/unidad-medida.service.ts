import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { UnidadMedida } from '../models/articulo.model';

/** Body for POST/PUT /sysfact/unidades-de-medida. */
export type UnidadMedidaInput = Omit<UnidadMedida, 'id'>;

@Injectable({ providedIn: 'root' })
export class UnidadMedidaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/unidades-de-medida`;

  listar(): Observable<UnidadMedida[]> {
    return this.http.get<UnidadMedida[]>(this.url);
  }

  crear(body: UnidadMedidaInput): Observable<UnidadMedida> {
    return this.http.post<UnidadMedida>(this.url, body);
  }

  actualizar(id: number, body: UnidadMedidaInput): Observable<UnidadMedida> {
    return this.http.put<UnidadMedida>(`${this.url}/${id}`, body);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
