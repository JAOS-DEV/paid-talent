"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { LanguageToggle } from "@/components/i18n";

const LOGO_SRC = "/brand/paid-talent-mark.svg";

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

  return (
    <header className="h-14 overflow-x-hidden border-b border-charcoal-700 bg-charcoal-900">
      <div className="mx-auto flex h-full min-w-0 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <Link href={logoHref} className="flex h-8 max-w-full items-center">
            <Image
              src={LOGO_SRC}
              alt="Paid Talent"
              width={168}
              height={32}
              priority
              unoptimized
              className="h-auto max-h-8 w-auto max-w-full object-contain object-left"
            />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
              {isAdmin && (
                <Link
                  href="/admin"
                  prefetch={false}
                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-gold-500 px-2.5 text-sm font-semibold text-charcoal-950 hover:bg-gold-600"
                >
                  {t("admin")}
                </Link>
              )}
              <Button
                variant="ghost"
                size="header"
                type="button"
                onClick={handleSignOut}
              >
                {t("signOutAction")}
              </Button>
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
