import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Auditoria } from '../models/auditoria.model';

export interface FiltroAuditoria {
  entidad?: string;
  accion?: string;
  usuarioId?: number | null;
  /** yyyy-MM-dd, both days included. */
  desde?: string;
  hasta?: string;
  limite?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/auditoria`;

  buscar(f: FiltroAuditoria): Observable<Auditoria[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(f)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<Auditoria[]>(this.url, { params });
  }
}
