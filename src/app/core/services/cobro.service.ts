import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Cobro, CobroInput, CuentaPorCobrar } from '../models/cobro.model';

@Injectable({ providedIn: 'root' })
export class CobroService {
  private readonly http = inject(HttpClient);

  /** Credit sales with a balance, oldest first. */
  pendientes(): Observable<CuentaPorCobrar[]> {
    return this.http.get<CuentaPorCobrar[]>(`${API_URL}/cobros/pendientes`);
  }

  porVenta(ventaId: number): Observable<Cobro[]> {
    return this.http.get<Cobro[]>(`${API_URL}/ventas/${ventaId}/cobros`);
  }

  registrar(ventaId: number, body: CobroInput): Observable<Cobro> {
    return this.http.post<Cobro>(`${API_URL}/ventas/${ventaId}/cobros`, body);
  }

  /** Payments are cancelled with a reason, never deleted. */
  anular(ventaId: number, cobroId: number, motivo: string): Observable<Cobro> {
    return this.http.post<Cobro>(`${API_URL}/ventas/${ventaId}/cobros/${cobroId}/anular`, { motivo });
  }
}
