export interface NavItem {
  displayName?: string;
  divider?: boolean;
  iconName?: string;
  navCap?: string;
  route?: string;
  /** Only users with one of these roles see the item; everyone sees it when omitted. */
  roles?: string[];
}
