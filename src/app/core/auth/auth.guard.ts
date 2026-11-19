import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Protects the private pages: without a valid session, redirects to login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.getValidToken()
    ? true
    : router.createUrlTree(['/authentication/login'], {
        queryParams: { returnUrl: state.url },
      });
};

/** Pages only an Administrador can use (the backend enforces it too). */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user()?.rol?.nombre === 'Administrador' ? true : router.createUrlTree(['/inicio']);
};

/** Pages for some roles only (the backend enforces it too). Others go to /inicio. */
export const rolGuard =
  (...roles: string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return roles.includes(auth.rol()) ? true : router.createUrlTree(['/inicio']);
  };

/** Keeps a user who is already logged in from seeing the login again. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.getValidToken() ? router.createUrlTree(['/inicio']) : true;
};
