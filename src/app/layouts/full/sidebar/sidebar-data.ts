import { NavItem } from './nav-item/nav-item';
import { ROLES_CATALOGO, ROL_ADMIN } from '../../../core/auth/permisos';

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
    roles: ROLES_CATALOGO,
  },
  {
    displayName: 'Unidades de medida',
    iconName: 'solar:ruler-line-duotone',
    route: '/unidades-de-medida',
    roles: ROLES_CATALOGO,
  },
  {
    displayName: 'Parámetros',
    iconName: 'solar:settings-line-duotone',
    route: '/parametros',
    roles: ROLES_CATALOGO,
  },
  {
    displayName: 'Usuarios',
    iconName: 'solar:user-id-line-duotone',
    route: '/usuarios',
    roles: [ROL_ADMIN],
  },
  {
    displayName: 'Auditoría',
    iconName: 'solar:shield-check-line-duotone',
    route: '/auditoria',
    roles: [ROL_ADMIN],
  },
];
