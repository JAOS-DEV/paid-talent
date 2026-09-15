import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  deletePhoto,
  moveOwnedGalleryPhoto,
  setCurrentApprovedPhoto,
} from "@/lib/moderation/photo-moderation";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.union([
  z.object({
    action: z.literal("makePrimary"),
  }),
  z.object({
    direction: z.enum(["up", "down"]),
  }),
]);

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

    if ("action" in validation.data) {
      const [profile] = await db
        .select({ id: workerProfiles.id })
        .from(workerProfiles)
        .where(eq(workerProfiles.userId, actor.user.userId))
        .limit(1);

      if (!profile) {
        return NextResponse.json(
          { error: "Worker profile not found" },
          { status: 404 }
        );
      }

      const result = await setCurrentApprovedPhoto(profile.id, id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error ?? "Failed to set primary photo" },
          { status: result.error === "Photo not found or not approved" ? 404 : 400 }
        );
      }

      return NextResponse.json({ success: true });
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
