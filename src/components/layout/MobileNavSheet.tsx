"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui";
import { MessagesNavLink } from "@/components/messaging/MessagesNavLink";
import type { AdminNavItem } from "@/components/admin/admin-nav-items";

export interface AccountNavItem {
  href: string;
  label: string;
  messages?: boolean;
  prefetch?: boolean;
  tone?: "admin";
}

interface MobileNavSheetProps {
  items: AccountNavItem[];
  adminItems?: Array<AdminNavItem & { count?: number }>;
  onSignOut: () => void;
}

const menuLinkClass =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-base font-medium text-charcoal-100 hover:bg-charcoal-800";

export function MobileNavSheet({
  items,
  adminItems = [],
  onSignOut,
}: MobileNavSheetProps): React.ReactElement {
  const t = useTranslations("navigation");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="header"
          className="w-8 px-0"
          aria-label={t("openMenu")}
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
        <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Account">
          {items.map((item) =>
            item.messages ? (
              <MessagesNavLink key={item.href} href={item.href} variant="menu" />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.prefetch}
                className={
                  item.tone === "admin"
                    ? `${menuLinkClass} text-gold-400`
                    : menuLinkClass
                }
              >
                {item.label}
              </Link>
            )
          )}
          {adminItems.length > 0 ? (
            <div className="mt-3 border-t border-charcoal-700 pt-3">
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={menuLinkClass}
                >
                  {item.label}
                  {item.count != null && item.count > 0 ? ` (${item.count})` : ""}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
        <div className="mt-4 border-t border-charcoal-700 pt-4">
          <Button type="button" variant="ghost" fullWidth onClick={onSignOut}>
            {t("signOutAction")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
