import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminNav } from "@/components/admin/AdminNav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({
  children,
}: AdminLayoutProps): Promise<React.ReactElement> {
  await requireAdminPage("/admin");

  return (
    <div className="min-h-screen bg-charcoal-950 text-charcoal-100">
      <AdminNav />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
