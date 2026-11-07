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

/** Keeps a user who is already logged in from seeing the login again. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.getValidToken() ? router.createUrlTree(['/inicio']) : true;
};
