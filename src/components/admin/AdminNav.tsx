"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui";
import { LanguageToggle } from "@/components/i18n";
import { NotificationsBell } from "@/components/notifications";
import { BrandMark } from "@/components/layout/BrandMark";
import {
  ADMIN_NAV_ITEMS,
  isAdminNavActive,
  type AdminNavItem,
} from "@/components/admin/admin-nav-items";

interface AdminNavItemWithCount extends AdminNavItem {
  count?: number;
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
  const router = useRouter();

  const items: AdminNavItemWithCount[] = ADMIN_NAV_ITEMS.map((item) => {
    if (item.href === "/admin/reports") {
      return { ...item, count: openReportCount };
    }
    if (item.href === "/admin/flags") {
      return { ...item, count: openFlagCount };
    }
    return item;
  });

  const signOutAdmin = (): void => {
    router.push("/auth/signout");
  };

  return (
    <header className="overflow-x-hidden border-b border-charcoal-800 bg-charcoal-950">
      <div className="mx-auto flex h-14 min-w-0 max-w-6xl items-center gap-2 px-3 md:hidden">
        <BrandMark href="/admin" />
        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />
          <NotificationsBell />
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="header"
                className="w-8 px-0"
                aria-label="Open menu"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </Button>
            </SheetTrigger>
            <SheetContent aria-describedby={undefined}>
              <SheetTitle className="sr-only">Admin</SheetTitle>
              <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Admin">
                {items.map((item) => {
                  const active = isAdminNavActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-base ${
                        active
                          ? "bg-primary-600/20 text-primary-300"
                          : "text-charcoal-100 hover:bg-charcoal-800"
                      }`}
                    >
                      {item.label}
                      {item.count != null && item.count > 0 ? ` (${item.count})` : ""}
                    </Link>
                  );
                })}
                <Link
                  href="/"
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-charcoal-300 hover:bg-charcoal-800"
                >
                  Back to app
                </Link>
              </nav>
              <div className="mt-4 border-t border-charcoal-700 pt-4">
                <Button type="button" variant="ghost" fullWidth onClick={signOutAdmin}>
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mx-auto hidden min-w-0 max-w-6xl flex-col gap-4 px-4 py-4 md:flex">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs uppercase tracking-wide text-charcoal-300">
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
            <NotificationsBell />
            <Link
              href="/"
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800"
            >
              Back to app
            </Link>
            <Button type="button" variant="ghost" size="sm" onClick={signOutAdmin}>
              Sign out
            </Button>
          </div>
        </div>

        <nav className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Admin">
          {items.map((item) => {
            const active = isAdminNavActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary-600/20 text-primary-300"
                    : "text-charcoal-300 hover:bg-charcoal-800"
                }`}
              >
                {item.label}
                {item.count != null && item.count > 0 ? ` (${item.count})` : ""}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
