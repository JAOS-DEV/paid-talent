import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { listAdminReports } from "@/lib/admin/reports";
import type { ReportStatus } from "@/lib/db/schema";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") ?? "open_queue";
    const status =
      statusParam === "open_queue" || statusParam === "all"
        ? statusParam
        : (statusParam as ReportStatus);

    const reports = await listAdminReports({ status });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[Admin reports] list failed:", error);
    return NextResponse.json({ error: "Failed to list reports" }, { status: 500 });
  }
}
