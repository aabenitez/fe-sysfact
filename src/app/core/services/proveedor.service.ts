import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Proveedor } from '../models/articulo.model';

@Injectable({ providedIn: 'root' })
export class ProveedorService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(`${API_URL}/proveedores`);
  }
}
