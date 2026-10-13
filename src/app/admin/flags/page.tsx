import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { listAdminFlags } from "@/lib/admin/reports";
import { FlagsQueue } from "@/components/admin/FlagsQueue";

export default async function AdminFlagsPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin/flags");
  const flags = await listAdminFlags({ status: "open" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Message flags</h1>
        <p className="text-charcoal-400 mt-1">
          Automated content flags from contact requests and chat.
        </p>
      </div>
      <FlagsQueue initialFlags={flags} />
    </div>
  );
}
