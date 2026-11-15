import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { UnidadMedida } from '../models/articulo.model';

@Injectable({ providedIn: 'root' })
export class UnidadMedidaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/unidades-de-medida`;

  listar(): Observable<UnidadMedida[]> {
    return this.http.get<UnidadMedida[]>(this.url);
  }
}
