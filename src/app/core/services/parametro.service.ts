import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Parametro } from '../models/parametro.model';

@Injectable({ providedIn: 'root' })
export class ParametroService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/parametros`;

  listar(): Observable<Parametro[]> {
    return this.http.get<Parametro[]>(this.url);
  }
}
