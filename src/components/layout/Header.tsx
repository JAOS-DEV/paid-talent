"use client";

import React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function Header(): React.ReactElement {
  const { data: session, status } = useSession();

  const getDashboardLink = (): string => {
    if (!session?.user) return "/auth/signin";
    return session.user.role === "worker"
      ? "/worker/dashboard"
      : "/recruiter/dashboard";
  };

  return (
    <header className="bg-charcoal-900 border-b border-charcoal-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary-500">Paid</span>
            <span className="text-xl font-bold text-gold-500">Talent</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            {session?.user?.role === "recruiter" && (
              <Link
                href="/recruiter/search"
                className="text-charcoal-300 hover:text-charcoal-100 transition-colors"
              >
                Search Workers
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-charcoal-700 animate-pulse" />
            ) : session?.user ? (
              <div className="flex items-center space-x-4">
                <Link href={getDashboardLink()}>
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-charcoal-400 hover:text-charcoal-200 text-sm transition-colors"
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
      </div>
    </header>
  );
}
