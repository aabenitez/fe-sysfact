import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Articulo } from '../models/articulo.model';

@Injectable({ providedIn: 'root' })
export class ArticuloService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/articulos`;

  listar(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(this.url);
  }
}
