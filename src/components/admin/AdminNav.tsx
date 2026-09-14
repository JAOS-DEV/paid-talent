"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

interface AdminNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const navItems: AdminNavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/verifications", label: "Identity verification" },
  { href: "/admin/photos", label: "Photo moderation" },
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

export function AdminNav(): React.ReactElement {
  const pathname = usePathname();

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
          {navItems.map((item) => {
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
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
