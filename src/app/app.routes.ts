import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: FullComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: '/inicio',
        pathMatch: 'full',
      },
      {
        path: 'inicio',
        title: 'Inicio · Sysfact',
        loadComponent: () =>
          import('./pages/inicio/inicio.component').then((m) => m.InicioComponent),
      },
      {
        path: 'articulos',
        title: 'Artículos · Sysfact',
        loadComponent: () =>
          import('./pages/articulos/articulos.component').then((m) => m.ArticulosComponent),
      },
      {
        path: 'parametros',
        title: 'Parámetros · Sysfact',
        loadComponent: () =>
          import('./pages/parametros/parametros.component').then((m) => m.ParametrosComponent),
      },
      // MatDash template demo pages (kept as a visual reference)
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'ui-components',
        loadChildren: () =>
          import('./pages/ui-components/ui-components.routes').then(
            (m) => m.UiComponentsRoutes
          ),
      },
      {
        path: 'extra',
        loadChildren: () =>
          import('./pages/extra/extra.routes').then((m) => m.ExtraRoutes),
      },
    ],
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
