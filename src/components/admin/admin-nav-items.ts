export interface AdminNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/verifications", label: "Identity verification" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/photos", label: "Photo moderation" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/flags", label: "Flags" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
];

export function isAdminNavActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
