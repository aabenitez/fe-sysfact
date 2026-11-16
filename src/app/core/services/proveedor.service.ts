import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Proveedor } from '../models/articulo.model';

/** Body for POST/PUT /sysfact/proveedores. */
export type ProveedorInput = Omit<Proveedor, 'id'>;

@Injectable({ providedIn: 'root' })
export class ProveedorService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/proveedores`;

  listar(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(this.url);
  }

  crear(body: ProveedorInput): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.url, body);
  }

  actualizar(id: number, body: ProveedorInput): Observable<Proveedor> {
    return this.http.put<Proveedor>(`${this.url}/${id}`, body);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
