import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { listAdminReports } from "@/lib/admin/reports";
import { ReportsQueue } from "@/components/admin/ReportsQueue";

export default async function AdminReportsPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin/reports");
  const reports = await listAdminReports({ status: "open_queue" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Reports</h1>
        <p className="text-charcoal-400 mt-1">
          Triage user safety reports. Highest severity first, then oldest.
        </p>
      </div>
      <ReportsQueue initialReports={reports} />
    </div>
  );
}
