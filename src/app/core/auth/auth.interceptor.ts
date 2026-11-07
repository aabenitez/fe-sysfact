import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../api.config';
import { AuthService } from './auth.service';

/**
 * Adds `Authorization: Bearer <token>` to API calls and, if the backend
 * answers 401 (token expired or invalid), closes the session.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(API_URL);
  const isLogin = req.url === `${API_URL}/login`;

  const token = isApi && !isLogin ? auth.getValidToken() : null;
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isApi && !isLogin) {
        auth.logout('expired');
      }
      return throwError(() => err);
    })
  );
};
