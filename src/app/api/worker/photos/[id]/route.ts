import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  deletePhoto,
  moveOwnedGalleryPhoto,
} from "@/lib/moderation/photo-moderation";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await params;
    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await moveOwnedGalleryPhoto(
      id,
      actor.user.userId,
      validation.data.direction
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to reorder photo" },
        { status: result.error === "Photo not found" ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Worker Photos] Reorder error:", error);
    return NextResponse.json(
      { error: "Failed to reorder photo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await params;
    const result = await deletePhoto(id, actor.user.userId, {
      allowPrimary: false,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to delete photo" },
        { status: result.error === "Photo not found" ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Worker Photos] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}
