import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Articulo, ArticuloInput } from '../models/articulo.model';

@Injectable({ providedIn: 'root' })
export class ArticuloService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/articulos`;

  listar(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(this.url);
  }

  crear(body: ArticuloInput): Observable<Articulo> {
    return this.http.post<Articulo>(this.url, body);
  }

  actualizar(id: number, body: ArticuloInput): Observable<Articulo> {
    return this.http.put<Articulo>(`${this.url}/${id}`, body);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Uploads (or replaces) the photo; the backend stores it as a medium-size JPEG. */
  subirImagen(id: number, archivo: File): Observable<Articulo> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<Articulo>(`${this.url}/${id}/imagen`, form);
  }

  quitarImagen(id: number): Observable<Articulo> {
    return this.http.delete<Articulo>(`${this.url}/${id}/imagen`);
  }
}
