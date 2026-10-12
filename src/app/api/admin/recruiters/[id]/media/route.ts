import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { getPendingRecruiterMediaForAdmin } from "@/lib/admin/pending-data";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { id } = await params;
    const media = await getPendingRecruiterMediaForAdmin({
      recruiterProfileId: id,
      adminEmail: guard.actor.email,
    });

    if (!media) {
      return NextResponse.json(
        { error: "Recruiter not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      idDocumentUrl: media.idDocumentUrl,
      livenessVideoUrl: media.livenessVideoUrl,
      livenessVideoContentType: media.livenessVideoContentType,
      expiresIn: media.expiresIn,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin recruiter media]", error);
    return NextResponse.json(
      { error: "Failed to load verification media" },
      { status: 500 }
    );
  }
}
