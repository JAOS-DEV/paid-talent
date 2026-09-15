import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, workerProfiles } from "@/lib/db";
import {
  getOwnedPhotosForWorker,
  isWorkerIdentityVerified,
} from "@/lib/moderation/photo-moderation";
import { checkPhotoLimits } from "@/lib/moderation/photo-policy";
import { hasApprovedPrimaryProfileImage } from "@/lib/media/photo-persistence";
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
      .select({
        id: workerProfiles.id,
        photoKey: workerProfiles.photoKey,
        photoUrl: workerProfiles.photoUrl,
        isVerified: workerProfiles.isVerified,
        verificationStatus: workerProfiles.verificationStatus,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({
        photos: [],
        hasApprovedPrimaryPhoto: false,
        canAddGalleryPhoto: false,
      });
    }

    const photos = await getOwnedPhotosForWorker(profile.id);
    const hasApprovedPrimaryPhoto = hasApprovedPrimaryProfileImage(profile);
    const approvedCount = photos.filter(
      (photo) => photo.moderationStatus === "approved"
    ).length;
    const pendingCount = photos.filter(
      (photo) => photo.moderationStatus === "pending"
    ).length;
    const galleryLimit = checkPhotoLimits(approvedCount, pendingCount, {
      purpose: "gallery",
      isVerified: isWorkerIdentityVerified(profile),
      hasApprovedPrimary: hasApprovedPrimaryPhoto,
    });

    return NextResponse.json({
      photos,
      hasApprovedPrimaryPhoto,
      canAddGalleryPhoto: galleryLimit.canUpload,
    });
  } catch (error) {
    console.error("[Worker Photos] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
