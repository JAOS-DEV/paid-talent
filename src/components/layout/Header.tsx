"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { LanguageToggle } from "@/components/i18n";

const MARK_SRC = "/brand/paid-talent-mark.svg";
const LOCKUP_SRC = "/brand/paid-talent-logo.svg";

function BrandLink({ href }: { href: string }): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label="Paid Talent"
      className="inline-flex h-8 shrink-0 items-center"
    >
      <Image
        src={MARK_SRC}
        alt=""
        width={32}
        height={32}
        priority
        unoptimized
        aria-hidden
        className="h-8 w-8 min-[380px]:hidden"
      />
      <Image
        src={LOCKUP_SRC}
        alt=""
        width={200}
        height={32}
        priority
        unoptimized
        aria-hidden
        className="hidden h-7 w-auto max-w-[180px] min-[380px]:block"
      />
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

  return (
    <header className="h-14 overflow-x-hidden border-b border-charcoal-700 bg-charcoal-900">
      <div className="mx-auto flex h-full min-w-0 max-w-7xl items-center justify-between gap-1.5 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <BrandLink href={logoHref} />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-gold-500 px-2 text-xs font-semibold text-charcoal-950 hover:bg-gold-600 sm:px-2.5 sm:text-sm"
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
