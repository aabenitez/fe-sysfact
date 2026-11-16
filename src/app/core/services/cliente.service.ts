import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Cliente, VentaResumen } from '../models/cliente.model';

/** Body for POST/PUT /sysfact/clientes. */
export type ClienteInput = Omit<Cliente, 'id'>;

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/clientes`;

  listar(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.url);
  }

  crear(body: ClienteInput): Observable<Cliente> {
    return this.http.post<Cliente>(this.url, body);
  }

  actualizar(id: number, body: ClienteInput): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.url}/${id}`, body);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  ventas(): Observable<VentaResumen[]> {
    return this.http.get<VentaResumen[]>(`${API_URL}/ventas`);
  }
}
