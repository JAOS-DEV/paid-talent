import { db, profilePhotos, workerProfiles } from "@/lib/db";
import type { PhotoModerationStatus, ProfilePhoto } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import {
  createModerationStagingSignedGet,
  deleteFile,
  deleteStagedProfilePhoto,
  promoteStagedProfilePhotoToPublic,
} from "@/lib/storage/s3";
import { assertOwnedPhotoStagingKey } from "@/lib/storage/keys";
import {
  hasApprovedPublicPhoto,
  persistenceForModerationDecision,
  shouldReplaceWorkerProfilePhotoOnDelete,
} from "@/lib/media/photo-persistence";
import {
  applyPhotoPolicy,
  checkPhotoLimits,
  type PhotoPolicyDecision,
  type PhotoLimitCheck,
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
  GALLERY_UNVERIFIED_REASON,
  type PhotoUploadPurpose,
} from "./photo-policy";
import { analyzeProfilePhoto } from "./photo-provider";

export interface PhotoUploadResult {
  success: boolean;
  photoId?: string;
  status?: PhotoModerationStatus;
  decision?: PhotoPolicyDecision;
  error?: string;
  userMessage?: string;
  photoKey?: string | null;
  photoUrl?: string | null;
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

export function isWorkerIdentityVerified(profile: {
  isVerified: boolean;
  verificationStatus: string;
}): boolean {
  return profile.verificationStatus === "verified" || profile.isVerified;
}

export async function canUploadPhoto(
  workerProfileId: string,
  purpose: PhotoUploadPurpose = "primary"
): Promise<PhotoLimitCheck> {
  const counts = await getPhotoCountsForWorker(workerProfileId);
  const [profile] = await db
    .select({
      isVerified: workerProfiles.isVerified,
      verificationStatus: workerProfiles.verificationStatus,
    })
    .from(workerProfiles)
    .where(eq(workerProfiles.id, workerProfileId))
    .limit(1);

  return checkPhotoLimits(counts.approved, counts.pending, {
    isVerified: profile ? isWorkerIdentityVerified(profile) : false,
    purpose,
  });
}

async function analyzePrivateStagingPhoto(
  stagingKey: string
): Promise<Awaited<ReturnType<typeof analyzeProfilePhoto>>> {
  const signedUrl = await createModerationStagingSignedGet(stagingKey);
  return analyzeProfilePhoto(signedUrl);
}

async function maybePromoteApprovedStaging(options: {
  userId: string;
  stagingKey: string;
  status: PhotoModerationStatus;
}): Promise<{ photoKey: string; photoUrl: string } | null> {
  if (options.status !== "approved") {
    return null;
  }

  return promoteStagedProfilePhotoToPublic(options.userId, options.stagingKey);
}

async function deleteStagingObjectQuietly(stagingKey: string | null): Promise<void> {
  if (!stagingKey) {
    return;
  }

  try {
    await deleteStagedProfilePhoto(stagingKey);
  } catch {
    console.warn("[Photo Moderation] Could not delete private staging object");
  }
}

async function deletePublicPhotoQuietly(photoKey: string | null): Promise<void> {
  if (!photoKey) {
    return;
  }

  try {
    await deleteFile(photoKey);
  } catch {
    console.warn("[Photo Moderation] Could not delete public profile photo");
  }
}

async function markFirstApprovedAsCurrent(
  workerProfileId: string,
  photo: ProfilePhoto
): Promise<void> {
  if (!hasApprovedPublicPhoto(photo)) {
    return;
  }

  const counts = await getPhotoCountsForWorker(workerProfileId);
  if (counts.approved !== 1) {
    return;
  }

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

export async function submitPhotoForModeration(
  userId: string,
  workerProfileId: string,
  stagingKey: string,
  options: { purpose?: PhotoUploadPurpose } = {}
): Promise<PhotoUploadResult> {
  assertOwnedPhotoStagingKey(userId, stagingKey);

  const purpose = options.purpose ?? "primary";
  const limitCheck = await canUploadPhoto(workerProfileId, purpose);

  if (!limitCheck.canUpload) {
    return {
      success: false,
      error: "upload_limit_reached",
      userMessage: limitCheck.reason,
    };
  }

  const analysis = await analyzePrivateStagingPhoto(stagingKey);
  const decision = applyPhotoPolicy(analysis);

  let promoted: { photoKey: string; photoUrl: string } | null = null;
  if (decision.status === "approved") {
    try {
      promoted = await maybePromoteApprovedStaging({
        userId,
        stagingKey,
        status: decision.status,
      });
    } catch {
      promoted = null;
    }
  }

  if (decision.status === "rejected") {
    await deleteStagingObjectQuietly(stagingKey);
  }

  const persistence = persistenceForModerationDecision(
    decision.status,
    stagingKey,
    promoted
  );

  const [photo] = await db
    .insert(profilePhotos)
    .values({
      userId,
      workerProfileId,
      stagingKey: persistence.stagingKey,
      photoKey: persistence.photoKey,
      photoUrl: persistence.photoUrl,
      moderationStatus: persistence.moderationStatus,
      moderationReason: decision.reason,
      moderationConfidence: Math.round(analysis.confidence * 100),
      moderationCategories: analysis.categories,
      displayOrder: limitCheck.currentApprovedCount,
    })
    .returning();

  if (persistence.moderationStatus === "approved" && purpose !== "gallery") {
    await markFirstApprovedAsCurrent(workerProfileId, photo);
  }

  const userMessage = getUserMessage(persistence.moderationStatus);

  return {
    success: true,
    photoId: photo.id,
    status: persistence.moderationStatus,
    decision: {
      ...decision,
      status: persistence.moderationStatus,
      action:
        persistence.moderationStatus === "pending" && decision.status === "approved"
          ? "quarantine"
          : decision.action,
      requiresReview:
        persistence.moderationStatus === "pending"
          ? true
          : decision.requiresReview,
    },
    userMessage,
    photoKey: persistence.photoKey,
    photoUrl: persistence.photoUrl,
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

  if (!photo.stagingKey) {
    return { success: false, error: "Photo staging object is missing" };
  }

  let promoted: { photoKey: string; photoUrl: string };
  try {
    promoted = await promoteStagedProfilePhotoToPublic(
      photo.userId,
      photo.stagingKey
    );
  } catch {
    return { success: false, error: "Could not promote photo to public storage" };
  }

  await db
    .update(profilePhotos)
    .set({
      moderationStatus: "approved",
      stagingKey: null,
      photoKey: promoted.photoKey,
      photoUrl: promoted.photoUrl,
      moderationReviewedAt: new Date(),
      moderationReviewedBy: reviewedBy,
      updatedAt: new Date(),
    })
    .where(eq(profilePhotos.id, photoId));

  const [approvedPhoto] = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.id, photoId))
    .limit(1);

  if (approvedPhoto) {
    await markFirstApprovedAsCurrent(photo.workerProfileId, approvedPhoto);
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
      stagingKey: null,
      photoKey: null,
      photoUrl: null,
      moderationReason: reason || "Rejected by moderator",
      moderationReviewedAt: new Date(),
      moderationReviewedBy: reviewedBy,
      updatedAt: new Date(),
    })
    .where(eq(profilePhotos.id, photoId));

  await deleteStagingObjectQuietly(photo.stagingKey);

  return { success: true };
}

export async function getApprovedPhotosForWorker(
  workerProfileId: string
): Promise<ProfilePhoto[]> {
  const photos = await db
    .select()
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, workerProfileId),
        eq(profilePhotos.moderationStatus, "approved")
      )
    )
    .orderBy(profilePhotos.displayOrder);

  return photos.filter(hasApprovedPublicPhoto);
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

  if (!photo || !hasApprovedPublicPhoto(photo)) {
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

export function toOwnedPhotoDto(photo: ProfilePhoto): {
  id: string;
  photoUrl: string | null;
  moderationStatus: PhotoModerationStatus;
  moderationReason: string | null;
  displayOrder: number;
  isCurrentApproved: boolean;
  createdAt: string;
} {
  return {
    id: photo.id,
    photoUrl:
      photo.moderationStatus === "approved" && hasApprovedPublicPhoto(photo)
        ? photo.photoUrl
        : null,
    moderationStatus: photo.moderationStatus,
    moderationReason: photo.moderationReason,
    displayOrder: photo.displayOrder,
    isCurrentApproved: photo.isCurrentApproved,
    createdAt: photo.createdAt.toISOString(),
  };
}

export async function getOwnedPhotosForWorker(
  workerProfileId: string
): Promise<ReturnType<typeof toOwnedPhotoDto>[]> {
  const photos = await getWorkerPhotos(workerProfileId, true);
  return photos.map(toOwnedPhotoDto);
}

export async function moveOwnedGalleryPhoto(
  photoId: string,
  userId: string,
  direction: "up" | "down"
): Promise<{ success: boolean; error?: string }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.userId, userId)))
    .limit(1);

  if (!photo) {
    return { success: false, error: "Photo not found" };
  }

  if (photo.isCurrentApproved) {
    return { success: false, error: "Primary photo order cannot be changed" };
  }

  if (photo.moderationStatus !== "approved" || !hasApprovedPublicPhoto(photo)) {
    return { success: false, error: "Only approved gallery photos can be reordered" };
  }

  const siblings = (await getApprovedPhotosForWorker(photo.workerProfileId)).filter(
    (item) => !item.isCurrentApproved
  );
  const index = siblings.findIndex((item) => item.id === photo.id);
  if (index < 0) {
    return { success: false, error: "Photo not found" };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  const neighbor = siblings[swapIndex];
  if (!neighbor) {
    return { success: true };
  }

  const photoOrder = photo.displayOrder;
  await db
    .update(profilePhotos)
    .set({ displayOrder: neighbor.displayOrder, updatedAt: new Date() })
    .where(eq(profilePhotos.id, photo.id));
  await db
    .update(profilePhotos)
    .set({ displayOrder: photoOrder, updatedAt: new Date() })
    .where(eq(profilePhotos.id, neighbor.id));

  return { success: true };
}

export async function deletePhoto(
  photoId: string,
  userId: string,
  options: { allowPrimary?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.userId, userId)))
    .limit(1);

  if (!photo) {
    return { success: false, error: "Photo not found" };
  }

  if (photo.isCurrentApproved && options.allowPrimary !== true) {
    return { success: false, error: "Cannot remove the primary profile photo" };
  }

  const shouldReplaceProfilePhoto =
    shouldReplaceWorkerProfilePhotoOnDelete(photo);
  const workerProfileId = photo.workerProfileId;

  await deleteStagingObjectQuietly(photo.stagingKey);
  if (hasApprovedPublicPhoto(photo)) {
    await deletePublicPhotoQuietly(photo.photoKey);
  }

  await db.delete(profilePhotos).where(eq(profilePhotos.id, photoId));

  if (!shouldReplaceProfilePhoto) {
    return { success: true };
  }

  const remaining = await getApprovedPhotosForWorker(workerProfileId);
  const nextPhoto = remaining[0];

  if (nextPhoto && hasApprovedPublicPhoto(nextPhoto)) {
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

  return { success: true };
}

export {
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
  GALLERY_UNVERIFIED_REASON,
};
