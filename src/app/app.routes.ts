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
        path: 'ventas',
        title: 'Ventas · Sysfact',
        loadComponent: () =>
          import('./pages/ventas/ventas.component').then((m) => m.VentasComponent),
      },
      {
        path: 'ventas/:id',
        title: 'Factura · Sysfact',
        loadComponent: () =>
          import('./pages/ventas/venta-detalle.component').then((m) => m.VentaDetalleComponent),
      },
      {
        path: 'clientes',
        title: 'Clientes · Sysfact',
        loadComponent: () =>
          import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent),
      },
      {
        path: 'articulos',
        title: 'Artículos · Sysfact',
        loadComponent: () =>
          import('./pages/articulos/articulos.component').then((m) => m.ArticulosComponent),
      },
      {
        path: 'proveedores',
        title: 'Proveedores · Sysfact',
        loadComponent: () =>
          import('./pages/proveedores/proveedores.component').then((m) => m.ProveedoresComponent),
      },
      {
        path: 'unidades-de-medida',
        title: 'Unidades de medida · Sysfact',
        loadComponent: () =>
          import('./pages/unidades-medida/unidades-medida.component').then(
            (m) => m.UnidadesMedidaComponent
          ),
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
      // Password recovery (public). The e-mailed link points to /cambiar-contrasena?token=...
      // (parameter url.change.password), so these live at the top level.
      {
        path: 'olvide-contrasena',
        title: 'Recuperar contraseña · Sysfact',
        loadComponent: () =>
          import('./pages/authentication/recuperar-clave/olvide-contrasena.component').then(
            (m) => m.OlvideContrasenaComponent
          ),
      },
      {
        path: 'cambiar-contrasena',
        title: 'Cambiar contraseña · Sysfact',
        loadComponent: () =>
          import('./pages/authentication/recuperar-clave/cambiar-contrasena.component').then(
            (m) => m.CambiarContrasenaComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
