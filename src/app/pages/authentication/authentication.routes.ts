import { Routes } from '@angular/router';

import { AppSideLoginComponent } from './side-login/side-login.component';
import { AppSideRegisterComponent } from './side-register/side-register.component';
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
      {
        path: 'register',
        component: AppSideRegisterComponent,
      },
    ],
  },
];
