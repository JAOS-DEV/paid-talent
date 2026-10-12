import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { listPendingRecruitersForAdmin } from "@/lib/admin/pending-data";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

export async function GET(): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { recruiters, count } = await listPendingRecruitersForAdmin({
      adminEmail: guard.actor.email,
      includeSignedMedia: false,
    });

    return NextResponse.json({
      success: true,
      workers: recruiters,
      recruiters,
      count,
    });
  } catch (error) {
    console.error("[Admin Recruiters Pending] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to fetch pending recruiters" },
      { status: 500 }
    );
  }
}
