import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Sysfact',
  },
  {
    displayName: 'Inicio',
    iconName: 'solar:home-smile-line-duotone',
    route: '/inicio',
  },
  {
    displayName: 'Ventas',
    iconName: 'solar:cart-large-2-line-duotone',
    route: '/ventas',
  },
  {
    displayName: 'Clientes',
    iconName: 'solar:users-group-rounded-line-duotone',
    route: '/clientes',
  },
  {
    displayName: 'Artículos',
    iconName: 'solar:box-line-duotone',
    route: '/articulos',
  },
  {
    displayName: 'Proveedores',
    iconName: 'solar:delivery-line-duotone',
    route: '/proveedores',
  },
  {
    displayName: 'Unidades de medida',
    iconName: 'solar:ruler-line-duotone',
    route: '/unidades-de-medida',
  },
  {
    displayName: 'Parámetros',
    iconName: 'solar:settings-line-duotone',
    route: '/parametros',
  },
  {
    displayName: 'Usuarios',
    iconName: 'solar:user-id-line-duotone',
    route: '/usuarios',
    roles: ['Administrador'],
  },
];
