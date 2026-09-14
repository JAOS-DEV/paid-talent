import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { getPendingPhotoMediaForAdmin } from "@/lib/admin/pending-data";
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
    const media = await getPendingPhotoMediaForAdmin({
      photoId: id,
      adminEmail: guard.actor.email,
    });

    if (!media) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      photoUrl: media.photoUrl,
      expiresIn: media.expiresIn,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin photo media]", error);
    return NextResponse.json(
      { error: "Failed to load photo media" },
      { status: 500 }
    );
  }
}
