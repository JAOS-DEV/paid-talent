"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";
import { LanguageToggle } from "@/components/i18n";

interface AdminNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

interface AdminNavItemWithCount extends AdminNavItem {
  count?: number;
}

const navItems: AdminNavItem[] = [
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

function isActivePath(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface AdminNavProps {
  openReportCount?: number;
  openFlagCount?: number;
}

export function AdminNav({
  openReportCount = 0,
  openFlagCount = 0,
}: AdminNavProps): React.ReactElement {
  const pathname = usePathname();

  const items: AdminNavItemWithCount[] = navItems.map((item) => {
    if (item.href === "/admin/reports") {
      return { ...item, count: openReportCount };
    }
    if (item.href === "/admin/flags") {
      return { ...item, count: openFlagCount };
    }
    return item;
  });

  return (
    <header className="border-b border-charcoal-800 bg-charcoal-950 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 min-w-0">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-1">
              Internal
            </p>
            <Link
              href="/admin"
              prefetch={false}
              className="text-lg font-semibold text-charcoal-100"
            >
              Admin
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg text-sm text-charcoal-400 hover:bg-charcoal-800 whitespace-nowrap"
            >
              Back to app
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          </div>
        </div>

        <nav
          className="flex flex-wrap items-center gap-2 min-w-0"
          aria-label="Admin"
        >
          {items.map((item) => {
            const active = isActivePath(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  active
                    ? "bg-primary-600/20 text-primary-300"
                    : "text-charcoal-300 hover:bg-charcoal-800"
                }`}
              >
                {item.label}
                {item.count != null && item.count > 0
                  ? ` (${item.count})`
                  : ""}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
