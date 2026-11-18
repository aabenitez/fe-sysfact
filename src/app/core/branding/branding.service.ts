import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api.config';

export const DEFAULT_LOGO = './assets/images/logos/logo.svg';
export const DEFAULT_FAVICON = 'favicon.ico';

/** Upload rules of each company image; the backend checks the same ones. */
export interface ImagenReglas {
  accept: string;
  maxBytes: number;
  formatos: string;
  maxLabel: string;
}

export const LOGO_REGLAS: ImagenReglas = {
  accept: '.png,.jpg,.jpeg,.webp,.gif,.svg',
  maxBytes: 2 * 1024 * 1024,
  formatos: 'PNG, JPG, WEBP, GIF o SVG',
  maxLabel: '2 MB',
};

export const FAVICON_REGLAS: ImagenReglas = {
  accept: '.ico,.png,.svg',
  maxBytes: 512 * 1024,
  formatos: 'ICO, PNG o SVG',
  maxLabel: '512 KB',
};

/**
 * One customizable company image. The backend serves it at GET /empresa/<name> (public) and
 * answers 404 when none is configured, in which case the default image is used.
 */
export class ImagenEmpresa {
  /** Bumped after every change so the browser does not show a cached image. */
  private readonly version = signal(Date.now());
  /** Set when the custom image failed to load (none configured, or backend down). */
  private readonly failed = signal(false);

  readonly url: Signal<string>;
  readonly isCustom = computed(() => !this.failed());

  constructor(
    private readonly http: HttpClient,
    private readonly endpoint: string,
    private readonly fallback: string,
    readonly reglas: ImagenReglas
  ) {
    this.url = computed(() => (this.failed() ? this.fallback : this.customUrl()));
  }

  /** URL of the custom image, even if it turns out not to exist. */
  customUrl(): string {
    return `${this.endpoint}?v=${this.version()}`;
  }

  /** Called by <img (error)>: fall back to the default image. */
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
    if (!this.reglas.accept.split(',').includes(`.${ext}`)) {
      return `Formato no permitido. Usá ${this.reglas.formatos}.`;
    }
    if (file.size > this.reglas.maxBytes) {
      return `La imagen no puede superar los ${this.reglas.maxLabel}.`;
    }
    return null;
  }
}

/** Company logo (parameter `empresa.logo`) and browser-tab favicon (parameter `empresa.favicon`). */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  readonly logo = new ImagenEmpresa(this.http, `${API_URL}/empresa/logo`, DEFAULT_LOGO, LOGO_REGLAS);
  readonly favicon = new ImagenEmpresa(
    this.http,
    `${API_URL}/empresa/favicon`,
    DEFAULT_FAVICON,
    FAVICON_REGLAS
  );

  // Shortcuts used by the header, the sidebar and the sale detail.
  readonly logoUrl = this.logo.url;
  readonly isCustom = this.logo.isCustom;
  markFailed(): void {
    this.logo.markFailed();
  }

  /**
   * Puts the custom favicon in the browser tab, or the default one if none is configured.
   * The image is loaded first so a 404 never leaves the tab without an icon.
   */
  applyFavicon(): void {
    const url = this.favicon.customUrl();
    const probe = new Image();
    probe.onload = () => this.setFaviconHref(url);
    probe.onerror = () => {
      this.favicon.markFailed();
      this.setFaviconHref(DEFAULT_FAVICON);
    };
    probe.src = url;
  }

  private setFaviconHref(href: string): void {
    const head = this.document.head;
    // Drop every icon link (the static one in index.html included) and add a single new one,
    // because some browsers ignore a changed href on an existing link.
    head.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove());
    const link = this.document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    head.appendChild(link);
  }
}
