import { db, profilePhotos, workerProfiles } from "@/lib/db";
import type { PhotoModerationStatus, ProfilePhoto } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import {
  applyPhotoPolicy,
  checkPhotoLimits,
  type PhotoPolicyDecision,
  type PhotoLimitCheck,
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
} from "./photo-policy";
import { analyzeProfilePhoto } from "./photo-provider";

export interface PhotoUploadResult {
  success: boolean;
  photoId?: string;
  status?: PhotoModerationStatus;
  decision?: PhotoPolicyDecision;
  error?: string;
  userMessage?: string;
}

export interface PhotoModerationDecision {
  status: PhotoModerationStatus;
  reason: string;
  categories?: string[];
  confidence?: number;
}

export async function getPhotoCountsForWorker(
  workerProfileId: string
): Promise<{ approved: number; pending: number }> {
  const [approvedResult] = await db
    .select({ count: count() })
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, workerProfileId),
        eq(profilePhotos.moderationStatus, "approved")
      )
    );

  const [pendingResult] = await db
    .select({ count: count() })
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, workerProfileId),
        eq(profilePhotos.moderationStatus, "pending")
      )
    );

  return {
    approved: approvedResult?.count ?? 0,
    pending: pendingResult?.count ?? 0,
  };
}

export async function canUploadPhoto(
  workerProfileId: string
): Promise<PhotoLimitCheck> {
  const counts = await getPhotoCountsForWorker(workerProfileId);
  return checkPhotoLimits(counts.approved, counts.pending);
}

export async function submitPhotoForModeration(
  userId: string,
  workerProfileId: string,
  photoKey: string,
  photoUrl: string
): Promise<PhotoUploadResult> {
  const limitCheck = await canUploadPhoto(workerProfileId);

  if (!limitCheck.canUpload) {
    return {
      success: false,
      error: "upload_limit_reached",
      userMessage: limitCheck.reason,
    };
  }

  const analysis = await analyzeProfilePhoto(photoUrl);
  const decision = applyPhotoPolicy(analysis);

  const [photo] = await db
    .insert(profilePhotos)
    .values({
      userId,
      workerProfileId,
      photoKey,
      photoUrl,
      moderationStatus: decision.status,
      moderationReason: decision.reason,
      moderationConfidence: Math.round(analysis.confidence * 100),
      moderationCategories: analysis.categories,
      displayOrder: limitCheck.currentApprovedCount,
    })
    .returning();

  if (decision.status === "approved") {
    const counts = await getPhotoCountsForWorker(workerProfileId);
    if (counts.approved === 1) {
      await db
        .update(profilePhotos)
        .set({ isCurrentApproved: true, updatedAt: new Date() })
        .where(eq(profilePhotos.id, photo.id));

      await db
        .update(workerProfiles)
        .set({
          photoKey: photo.photoKey,
          photoUrl: photo.photoUrl,
          updatedAt: new Date(),
        })
        .where(eq(workerProfiles.id, workerProfileId));
    }
  }

  const userMessage = getUserMessage(decision.status);

  return {
    success: true,
    photoId: photo.id,
    status: decision.status,
    decision,
    userMessage,
  };
}

function getUserMessage(status: PhotoModerationStatus): string {
  switch (status) {
    case "pending":
      return PHOTO_POLICY_COPY.pending;
    case "rejected":
      return PHOTO_POLICY_COPY.rejected;
    case "approved":
      return "Photo approved and visible on your profile.";
  }
}

export async function approvePhoto(
  photoId: string,
  reviewedBy: string
): Promise<{ success: boolean; error?: string }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.id, photoId))
    .limit(1);

  if (!photo) {
    return { success: false, error: "Photo not found" };
  }

  if (photo.moderationStatus !== "pending") {
    return { success: false, error: "Photo is not pending review" };
  }

  await db
    .update(profilePhotos)
    .set({
      moderationStatus: "approved",
      moderationReviewedAt: new Date(),
      moderationReviewedBy: reviewedBy,
      updatedAt: new Date(),
    })
    .where(eq(profilePhotos.id, photoId));

  const approvedPhotos = await db
    .select()
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, photo.workerProfileId),
        eq(profilePhotos.moderationStatus, "approved")
      )
    );

  if (approvedPhotos.length === 1) {
    await db
      .update(profilePhotos)
      .set({ isCurrentApproved: true, updatedAt: new Date() })
      .where(eq(profilePhotos.id, photoId));

    await db
      .update(workerProfiles)
      .set({
        photoKey: photo.photoKey,
        photoUrl: photo.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, photo.workerProfileId));
  }

  return { success: true };
}

export async function rejectPhoto(
  photoId: string,
  reviewedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.id, photoId))
    .limit(1);

  if (!photo) {
    return { success: false, error: "Photo not found" };
  }

  if (photo.moderationStatus !== "pending") {
    return { success: false, error: "Photo is not pending review" };
  }

  await db
    .update(profilePhotos)
    .set({
      moderationStatus: "rejected",
      moderationReason: reason || "Rejected by moderator",
      moderationReviewedAt: new Date(),
      moderationReviewedBy: reviewedBy,
      updatedAt: new Date(),
    })
    .where(eq(profilePhotos.id, photoId));

  return { success: true };
}

export async function getApprovedPhotosForWorker(
  workerProfileId: string
): Promise<ProfilePhoto[]> {
  return db
    .select()
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, workerProfileId),
        eq(profilePhotos.moderationStatus, "approved")
      )
    )
    .orderBy(profilePhotos.displayOrder);
}

export async function getPendingPhotosForReview(): Promise<ProfilePhoto[]> {
  return db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.moderationStatus, "pending"))
    .orderBy(profilePhotos.createdAt);
}

export async function getWorkerPhotos(
  workerProfileId: string,
  includeAll: boolean = false
): Promise<ProfilePhoto[]> {
  if (includeAll) {
    return db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.workerProfileId, workerProfileId))
      .orderBy(profilePhotos.displayOrder);
  }

  return getApprovedPhotosForWorker(workerProfileId);
}

export async function setCurrentApprovedPhoto(
  workerProfileId: string,
  photoId: string
): Promise<{ success: boolean; error?: string }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.id, photoId),
        eq(profilePhotos.workerProfileId, workerProfileId),
        eq(profilePhotos.moderationStatus, "approved")
      )
    )
    .limit(1);

  if (!photo) {
    return { success: false, error: "Photo not found or not approved" };
  }

  await db
    .update(profilePhotos)
    .set({ isCurrentApproved: false, updatedAt: new Date() })
    .where(eq(profilePhotos.workerProfileId, workerProfileId));

  await db
    .update(profilePhotos)
    .set({ isCurrentApproved: true, updatedAt: new Date() })
    .where(eq(profilePhotos.id, photoId));

  await db
    .update(workerProfiles)
    .set({
      photoKey: photo.photoKey,
      photoUrl: photo.photoUrl,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.id, workerProfileId));

  return { success: true };
}

export async function deletePhoto(
  photoId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.userId, userId)))
    .limit(1);

  if (!photo) {
    return { success: false, error: "Photo not found" };
  }

  const wasCurrentApproved = photo.isCurrentApproved;
  const workerProfileId = photo.workerProfileId;

  await db.delete(profilePhotos).where(eq(profilePhotos.id, photoId));

  if (wasCurrentApproved) {
    const [nextPhoto] = await db
      .select()
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.workerProfileId, workerProfileId),
          eq(profilePhotos.moderationStatus, "approved")
        )
      )
      .orderBy(profilePhotos.displayOrder)
      .limit(1);

    if (nextPhoto) {
      await db
        .update(profilePhotos)
        .set({ isCurrentApproved: true, updatedAt: new Date() })
        .where(eq(profilePhotos.id, nextPhoto.id));

      await db
        .update(workerProfiles)
        .set({
          photoKey: nextPhoto.photoKey,
          photoUrl: nextPhoto.photoUrl,
          updatedAt: new Date(),
        })
        .where(eq(workerProfiles.id, workerProfileId));
    } else {
      await db
        .update(workerProfiles)
        .set({
          photoKey: null,
          photoUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(workerProfiles.id, workerProfileId));
    }
  }

  return { success: true };
}

export {
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
};
