import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, workerProfiles } from "@/lib/db";
import { getOwnedPhotosForWorker } from "@/lib/moderation/photo-moderation";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const [profile] = await db
      .select({ id: workerProfiles.id })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ photos: [] });
    }

    const photos = await getOwnedPhotosForWorker(profile.id);
    return NextResponse.json({ photos });
  } catch (error) {
    console.error("[Worker Photos] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
