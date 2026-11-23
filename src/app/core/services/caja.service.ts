import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { CajaResumen, CierreInput } from '../models/caja.model';

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http = inject(HttpClient);

  /** What came in on a day (yyyy-MM-dd; today when omitted) and its closing. */
  resumen(fecha?: string): Observable<CajaResumen> {
    const params = fecha ? new HttpParams().set('fecha', fecha) : undefined;
    return this.http.get<CajaResumen>(`${API_URL}/caja`, { params });
  }

  cerrar(body: CierreInput): Observable<CajaResumen> {
    return this.http.post<CajaResumen>(`${API_URL}/caja/cierres`, body);
  }

  /** Administrators only: the day can then be closed again. */
  anular(cierreId: number, motivo: string): Observable<CajaResumen> {
    return this.http.post<CajaResumen>(`${API_URL}/caja/cierres/${cierreId}/anular`, { motivo });
  }
}
