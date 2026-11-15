import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Venta } from '../models/venta.model';

@Injectable({ providedIn: 'root' })
export class VentaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/ventas`;

  listar(): Observable<Venta[]> {
    return this.http.get<Venta[]>(this.url);
  }

  obtener(id: number): Observable<Venta | null> {
    // The backend answers 404 when the id does not exist (204/null is handled too).
    return this.http.get<Venta | null>(`${this.url}/${id}`);
  }
}
