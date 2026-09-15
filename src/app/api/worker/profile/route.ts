import { NextResponse } from "next/server";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import {
  getOwnedPhotosForWorker,
  hasSubmittedProfilePhoto,
} from "@/lib/moderation/photo-moderation";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({
        profile: null,
        photoOnboarding: {
          hasSubmittedPhoto: false,
          pendingPreviewUrl: null,
        },
      });
    }

    const [hasSubmittedPhoto, ownedPhotos] = await Promise.all([
      hasSubmittedProfilePhoto(profile.id),
      getOwnedPhotosForWorker(profile.id),
    ]);

    const pendingPrimary = ownedPhotos.find(
      (photo) => photo.moderationStatus === "pending" && !photo.photoUrl
    );

    return NextResponse.json({
      profile: {
        ...profile,
        hasSubmittedPhoto,
      },
      photoOnboarding: {
        hasSubmittedPhoto,
        pendingPreviewUrl: pendingPrimary?.previewUrl ?? null,
      },
    });
  } catch (error) {
    console.error("[Worker Profile] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
