import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Venta, VentaInput } from '../models/venta.model';
import { Auditoria } from '../models/auditoria.model';

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

  crear(body: VentaInput): Observable<Venta> {
    return this.http.post<Venta>(this.url, body);
  }

  actualizar(id: number, body: VentaInput): Observable<Venta> {
    return this.http.put<Venta>(`${this.url}/${id}`, body);
  }

  /** Sales are cancelled with a reason, never deleted. */
  anular(id: number, motivo: string): Observable<Venta> {
    return this.http.post<Venta>(`${this.url}/${id}/anular`, { motivo });
  }

  historial(id: number): Observable<Auditoria[]> {
    return this.http.get<Auditoria[]>(`${this.url}/${id}/historial`);
  }
}
