import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listPendingWorkersForAdmin } from "@/lib/admin/pending-data";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = isAdminEmail(session.user.email);

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        {
          error: "Forbidden",
          reason: adminCheck.reason,
        },
        { status: 403 }
      );
    }

    const { workers, count } = await listPendingWorkersForAdmin({
      adminEmail: adminCheck.email ?? "",
      includeSignedMedia: false,
    });

    return NextResponse.json({
      success: true,
      workers,
      count,
    });
  } catch (error) {
    console.error("[Admin Workers Pending] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to fetch pending workers" },
      { status: 500 }
    );
  }
}
