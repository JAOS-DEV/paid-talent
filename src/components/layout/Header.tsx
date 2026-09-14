"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function Header(): React.ReactElement {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getDashboardLink = (): string => {
    if (!session?.user) return "/auth/signin";
    return session.user.role === "worker"
      ? "/worker/dashboard"
      : "/recruiter/dashboard";
  };

  const isRecruiter = session?.user?.role === "recruiter";

  const recruiterLinks = [
    { href: "/recruiter/search", label: "Search Workers" },
    { href: "/recruiter/openings", label: "Openings" },
    { href: "/recruiter/profile", label: "Profile" },
    { href: "/recruiter/interests", label: "Interests" },
  ];

  return (
    <header className="bg-charcoal-900 border-b border-charcoal-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary-500">Paid</span>
            <span className="text-xl font-bold text-gold-500">Talent</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            {isRecruiter &&
              recruiterLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-charcoal-300 hover:text-charcoal-100 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
          </nav>

          <div className="flex items-center space-x-3">
            {isRecruiter && (
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-charcoal-300 hover:bg-charcoal-800"
                aria-expanded={mobileOpen}
                aria-controls="recruiter-mobile-nav"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileOpen((open) => !open)}
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

            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-charcoal-700 animate-pulse" />
            ) : session?.user ? (
              <div className="flex items-center space-x-3">
                <Link href={getDashboardLink()}>
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-charcoal-400 hover:text-charcoal-200 text-sm transition-colors min-h-11"
                >
                  Sign out
                </button>
              </div>
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

        {isRecruiter && mobileOpen && (
          <nav
            id="recruiter-mobile-nav"
            className="md:hidden border-t border-charcoal-700 py-3 space-y-1"
          >
            {recruiterLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-2 py-3 text-charcoal-200 hover:bg-charcoal-800 rounded-lg"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
