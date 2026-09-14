"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function Header(): React.ReactElement {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getDashboardLink = (): string => {
    if (!session?.user || session.user.signupPending) {
      return "/auth/role-select";
    }
    return session.user.role === "worker"
      ? "/worker/dashboard"
      : "/recruiter/dashboard";
  };

  const isFullUser = !!session?.user && session.user.signupPending !== true;
  const isWorker = isFullUser && session?.user?.role === "worker";
  const isRecruiter = isFullUser && session?.user?.role === "recruiter";
  const isAdmin = isFullUser && session?.user?.isAdmin === true;
  const needsMobileMenu = isFullUser && (isRecruiter || isAdmin);

  const roleLinks = isRecruiter
    ? [
        { href: "/recruiter/search", label: "Search Workers" },
        { href: "/recruiter/openings", label: "Openings" },
        { href: "/recruiter/profile", label: "Profile" },
        { href: "/recruiter/interests", label: "Interests" },
      ]
    : isWorker
      ? [
          { href: "/worker/profile", label: "Profile" },
          { href: "/worker/verification", label: "Verification" },
        ]
      : [];

  const closeMobileMenu = (): void => {
    setMobileOpen(false);
  };

  const toggleMobileMenu = (): void => {
    setMobileOpen((open) => !open);
  };

  const handleSignOut = (): void => {
    void signOut({ callbackUrl: "/" });
  };

  return (
    <header className="bg-charcoal-900 border-b border-charcoal-700 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
        <div className="flex items-center justify-between gap-3 h-16 min-w-0">
          <Link href="/" className="flex items-center space-x-2 min-w-0 shrink">
            <span className="text-xl font-bold text-primary-500 whitespace-nowrap">
              Paid
            </span>
            <span className="text-xl font-bold text-gold-500 whitespace-nowrap">
              Talent
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 min-w-0">
            {roleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-charcoal-300 hover:text-charcoal-100 transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-charcoal-700 animate-pulse" />
            ) : session?.user?.signupPending ? (
              <Link href="/auth/role-select">
                <Button variant="primary" size="sm">
                  Finish signup
                </Button>
              </Link>
            ) : isFullUser ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    prefetch={false}
                    className="inline-flex items-center justify-center min-h-11 px-3 py-1.5 text-sm rounded-lg bg-gold-500 hover:bg-gold-600 text-charcoal-950 font-semibold whitespace-nowrap"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href={getDashboardLink()}
                  className={needsMobileMenu ? "hidden md:inline-flex" : "inline-flex"}
                >
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={
                    needsMobileMenu
                      ? "hidden md:inline-flex text-charcoal-400 hover:text-charcoal-200 text-sm transition-colors min-h-11 items-center whitespace-nowrap"
                      : "inline-flex text-charcoal-400 hover:text-charcoal-200 text-sm transition-colors min-h-11 items-center whitespace-nowrap"
                  }
                >
                  Sign out
                </button>
                {needsMobileMenu && (
                  <button
                    type="button"
                    className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-charcoal-300 hover:bg-charcoal-800"
                    aria-expanded={mobileOpen}
                    aria-controls="account-mobile-nav"
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    onClick={toggleMobileMenu}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      {mobileOpen ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      )}
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/auth/role-select">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {needsMobileMenu && mobileOpen && (
          <nav
            id="account-mobile-nav"
            className="md:hidden border-t border-charcoal-700 py-3 space-y-1"
          >
            {roleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-2 py-3 text-charcoal-200 hover:bg-charcoal-800 rounded-lg"
                onClick={closeMobileMenu}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={getDashboardLink()}
              className="block px-2 py-3 text-charcoal-200 hover:bg-charcoal-800 rounded-lg"
              onClick={closeMobileMenu}
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full text-left px-2 py-3 text-charcoal-200 hover:bg-charcoal-800 rounded-lg"
            >
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
