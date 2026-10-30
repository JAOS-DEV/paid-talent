"use client";

import React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { LanguageToggle } from "@/components/i18n";
import { MessagesNavLink } from "@/components/messaging/MessagesNavLink";
import { NotificationsBell } from "@/components/notifications";
import { ADMIN_NAV_ITEMS } from "@/components/admin/admin-nav-items";
import { BrandMark } from "./BrandMark";
import { MobileNavSheet, type AccountNavItem } from "./MobileNavSheet";

const desktopLinkClass =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-2 text-xs font-medium text-charcoal-200 hover:bg-charcoal-800 lg:px-2.5 lg:text-sm";

function DesktopNavLink({ item }: { item: AccountNavItem }): React.ReactElement {
  if (item.messages) {
    return <MessagesNavLink href={item.href} />;
  }
  return (
    <Link
      href={item.href}
      prefetch={item.prefetch}
      className={
        item.tone === "admin"
          ? "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-gold-500 px-2 text-xs font-semibold text-charcoal-950 hover:bg-gold-600 lg:px-2.5 lg:text-sm"
          : desktopLinkClass
      }
    >
      {item.label}
    </Link>
  );
}

export function Header(): React.ReactElement {
  const t = useTranslations("navigation");
  const { data: session, status } = useSession();

  const getDashboardLink = (): string => {
    if (!session?.user || session.user.signupPending) {
      return "/auth/role-select";
    }
    return session.user.role === "worker"
      ? "/worker/dashboard"
      : "/recruiter/dashboard";
  };

  const isFullUser = !!session?.user && session.user.signupPending !== true;
  const isAdmin = isFullUser && session?.user?.isAdmin === true;
  const logoHref =
    status === "authenticated" && session?.user ? getDashboardLink() : "/";

  const handleSignOut = (): void => {
    void signOut({ callbackUrl: "/" });
  };

  const navItems: AccountNavItem[] = [];
  if (isFullUser && session?.user?.role === "worker") {
    navItems.push(
      { href: "/worker/dashboard", label: t("dashboard") },
      { href: "/worker/requests", label: t("requests") },
      { href: "/worker/messages", label: t("messages"), messages: true },
      { href: "/worker/profile", label: t("profile") },
      { href: "/settings/notifications", label: t("settings") }
    );
  }
  if (isFullUser && session?.user?.role === "recruiter") {
    navItems.push(
      { href: "/recruiter/search", label: t("search") },
      { href: "/recruiter/openings", label: t("openings") },
      { href: "/recruiter/venues", label: t("venues") },
      { href: "/recruiter/requests", label: t("requests") },
      { href: "/recruiter/messages", label: t("messages"), messages: true },
      { href: "/recruiter/profile", label: t("profile") },
      { href: "/recruiter/billing", label: t("billing") },
      { href: "/settings/notifications", label: t("settings") }
    );
  }
  if (isAdmin) {
    navItems.push({
      href: "/admin",
      label: t("admin"),
      prefetch: false,
      tone: "admin",
    });
  }

  const sheetItems = navItems.filter((item) => item.tone !== "admin");
  const sheetAdminItems = isAdmin ? ADMIN_NAV_ITEMS : [];

  return (
    <header className="h-14 overflow-x-hidden border-b border-charcoal-700 bg-charcoal-900">
      <div className="mx-auto flex h-full min-w-0 max-w-7xl items-center gap-1.5 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <BrandMark href={logoHref} />

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {isFullUser ? (
            <nav
              className="hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex"
              aria-label="Account"
            >
              {navItems.map((item) => (
                <DesktopNavLink key={item.href} item={item} />
              ))}
            </nav>
          ) : null}
          <LanguageToggle />
          {status === "loading" ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-charcoal-700" />
          ) : session?.user?.signupPending ? (
            <Link href="/auth/role-select" className="inline-flex">
              <Button variant="primary" size="header" type="button">
                {t("finishSignup")}
              </Button>
            </Link>
          ) : isFullUser ? (
            <>
              <NotificationsBell />
              <div className="md:hidden">
                <MobileNavSheet
                  items={sheetItems}
                  adminItems={sheetAdminItems}
                  onSignOut={handleSignOut}
                />
              </div>
              <div className="hidden md:block">
                <Button
                  variant="ghost"
                  size="header"
                  type="button"
                  onClick={handleSignOut}
                >
                  {t("signOutAction")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="inline-flex">
                <Button variant="ghost" size="header" type="button">
                  {t("signInAction")}
                </Button>
              </Link>
              <Link href="/auth/role-select" className="inline-flex">
                <Button variant="primary" size="header" type="button">
                  {t("getStarted")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
