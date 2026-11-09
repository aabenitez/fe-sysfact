import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api.config';

export const DEFAULT_LOGO = './assets/images/logos/logo.svg';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg';

/**
 * Company logo. The backend serves it from the `empresa.logo` parameter at
 * GET /empresa/logo (public) and answers 404 when none is configured, in which
 * case the default MatDash logo is shown.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_URL}/empresa/logo`;

  /** Bumped after every change so the browser does not show a cached image. */
  private readonly version = signal(Date.now());
  /** Set when the custom logo failed to load (none configured, or backend down). */
  private readonly failed = signal(false);

  readonly logoUrl = computed(() =>
    this.failed() ? DEFAULT_LOGO : `${this.endpoint}?v=${this.version()}`
  );
  readonly isCustom = computed(() => !this.failed());

  /** Called by <img (error)>: fall back to the default logo. */
  markFailed(): void {
    this.failed.set(true);
  }

  refresh(): void {
    this.failed.set(false);
    this.version.set(Date.now());
  }

  upload(file: File): Observable<{ valor: string }> {
    const body = new FormData();
    body.append('archivo', file);
    return this.http.post<{ valor: string }>(this.endpoint, body).pipe(tap(() => this.refresh()));
  }

  reset(): Observable<void> {
    return this.http.delete<void>(this.endpoint).pipe(tap(() => this.refresh()));
  }

  /** Same rules as the backend, checked before uploading. Returns an error message or null. */
  validate(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!LOGO_ACCEPT.split(',').includes(`.${ext}`)) {
      return 'Formato no permitido. Usá PNG, JPG, WEBP, GIF o SVG.';
    }
    if (file.size > LOGO_MAX_BYTES) {
      return 'La imagen no puede superar los 2 MB.';
    }
    return null;
  }
}
