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
];

export function AdminNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <header className="border-b border-charcoal-800 bg-charcoal-950">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-1">
            Internal
          </p>
          <Link href="/admin" className="text-lg font-semibold text-charcoal-100">
            Admin Review Console
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2" aria-label="Admin">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary-600/20 text-primary-300"
                    : "text-charcoal-300 hover:bg-charcoal-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-sm text-charcoal-400 hover:bg-charcoal-800"
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
        </nav>
      </div>
    </header>
  );
}
