import { Routes } from '@angular/router';

import { AppSideLoginComponent } from './side-login/side-login.component';
import { guestGuard } from '../../core/auth/auth.guard';

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
      {
        path: 'login',
        title: 'Iniciar sesión · Sysfact',
        component: AppSideLoginComponent,
        canActivate: [guestGuard],
      },
    ],
  },
];
