import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../api.config';

/** Public "I forgot my password" endpoints (POST /sysfact/recuperar-clave/*), no login needed. */
@Injectable({ providedIn: 'root' })
export class RecuperarClaveService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/recuperar-clave`;

  /** Asks for the e-mail with the link. The backend answers the same whether the e-mail exists or not. */
  solicitar(correo: string): Observable<void> {
    return this.http.post<void>(`${this.url}/solicitar`, { correo });
  }

  /** Whether the link's token still works (exists and has not expired). */
  validar(token: string): Observable<boolean> {
    return this.http
      .post<{ valido: boolean }>(`${this.url}/validar`, { token })
      .pipe(map((r) => r.valido));
  }

  cambiar(token: string, password: string, passwordConfirm: string): Observable<void> {
    return this.http.post<void>(`${this.url}/cambiar`, { token, password, passwordConfirm });
  }
}
