import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { API_URL } from '../api.config';
import { LoginResponse, SessionUser } from './auth.models';

const STORAGE_KEY = 'sysfact.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<SessionUser | null>(this.restore());

  /** Current user (null when there is no session). */
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly fullName = computed(() => {
    const u = this._user();
    return u ? `${u.nombres} ${u.apellidos}`.trim() : '';
  });
  readonly initials = computed(() => {
    const u = this._user();
    if (!u) return '';
    return `${u.nombres?.[0] ?? ''}${u.apellidos?.[0] ?? ''}`.toUpperCase();
  });

  /**
   * Authenticates against the backend.
   * @param remember true → localStorage (survives closing the browser); false → sessionStorage.
   */
  login(username: string, password: string, remember: boolean): Observable<SessionUser> {
    return this.http
      .post<LoginResponse>(`${API_URL}/login`, { username, password })
      .pipe(
        map((res) => res.user),
        tap((user) => this.store(user, remember))
      );
  }

  logout(reason?: 'expired'): void {
    this.clearStorage();
    this._user.set(null);
    this.router.navigate(['/authentication/login'], {
      queryParams: reason ? { motivo: reason } : undefined,
    });
  }

  /** Returns the token if it exists and has not expired; otherwise clears the session. */
  getValidToken(): string | null {
    const user = this._user();
    if (!user?.token) return null;
    if (this.isExpired(user.token)) {
      this.clearStorage();
      this._user.set(null);
      return null;
    }
    return user.token;
  }

  // ---------------------------------------------------------------------------

  private isExpired(token: string): boolean {
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(payload)) as { exp?: number };
      return !exp || exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  private store(user: SessionUser, remember: boolean): void {
    this.clearStorage();
    const storage = remember ? localStorage : sessionStorage;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable (private mode, etc.): the session only lives in memory.
    }
    this._user.set(user);
  }

  private restore(): SessionUser | null {
    try {
      const raw =
        sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }

  private clearStorage(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
