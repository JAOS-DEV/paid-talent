import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOwnerPendingPhotoPreview } from "@/lib/moderation/photo-moderation";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await params;
    const result = await getOwnerPendingPhotoPreview(id, actor.user.userId);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      previewUrl: result.previewUrl,
    });
  } catch (error) {
    console.error("[Worker Photo Preview] Error:", error);
    return NextResponse.json(
      { error: "Failed to load photo preview" },
      { status: 500 }
    );
  }
}
