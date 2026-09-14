import React from "react";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout only enforces allowlist for authenticated users (notFound).
 * Unauthenticated redirects with the exact callbackUrl are handled by
 * middleware + per-page `requireAdminPage(pathname)` — not this layout —
 * so deep links like /admin/verifications keep their path.
 */
export default async function AdminLayout({
  children,
}: AdminLayoutProps): Promise<React.ReactElement> {
  const session = await auth();

  if (session?.user) {
    const check = isAdminEmail(session.user.email);
    if (!check.isAdmin) {
      notFound();
    }

    return (
      <div className="min-h-screen bg-charcoal-950 text-charcoal-100 overflow-x-hidden">
        <AdminNav />
        <main className="max-w-6xl mx-auto px-4 py-8 min-w-0">{children}</main>
      </div>
    );
  }

  // Unauthenticated: page-level requireAdminPage redirects with exact path.
  // Do not render admin chrome (avoids leaking shell before redirect).
  return <>{children}</>;
}
