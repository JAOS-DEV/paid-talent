import { db, profilePhotos, workerProfiles } from "@/lib/db";
import type { PhotoModerationStatus, ProfilePhoto } from "@/lib/db/schema";
import { eq, and, count, sql, inArray } from "drizzle-orm";
import {
  createModerationStagingSignedGet,
  deleteFile,
  deleteStagedProfilePhoto,
  getSignedPhotoStagingUrlForOwner,
  promoteStagedProfilePhotoToPublic,
} from "@/lib/storage/s3";
import { assertOwnedPhotoStagingKey } from "@/lib/storage/keys";
import {
  hasApprovedPrimaryProfileImage,
  hasApprovedPublicPhoto,
  pendingPhotoPersistence,
  shouldReplaceWorkerProfilePhotoOnDelete,
} from "@/lib/media/photo-persistence";
import {
  decidePhotoSubmission,
  checkPhotoLimits,
  type PhotoPolicyDecision,
  type PhotoLimitCheck,
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
  GALLERY_UNVERIFIED_REASON,
  GALLERY_PRIMARY_PENDING_REASON,
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
      photoKey: workerProfiles.photoKey,
      photoUrl: workerProfiles.photoUrl,
    })
    .from(workerProfiles)
    .where(eq(workerProfiles.id, workerProfileId))
    .limit(1);

  return checkPhotoLimits(counts.approved, counts.pending, {
    isVerified: profile ? isWorkerIdentityVerified(profile) : false,
    purpose,
    hasApprovedPrimary: profile
      ? hasApprovedPrimaryProfileImage(profile)
      : false,
  });
}

export interface InsertProfilePhotoSlotInput {
  userId: string;
  workerProfileId: string;
  purpose: PhotoUploadPurpose;
  moderationReason: string | null;
  moderationConfidence: number | null;
  moderationCategories: string[] | null;
  buildRow: (limitCheck: PhotoLimitCheck) => Promise<{
    stagingKey: string | null;
    photoKey: string | null;
    photoUrl: string | null;
    moderationStatus: PhotoModerationStatus;
  }>;
}

export async function insertProfilePhotoWithSlotLock(
  input: InsertProfilePhotoSlotInput
): Promise<
  | { success: true; photo: ProfilePhoto; limitCheck: PhotoLimitCheck }
  | { success: false; error: string; userMessage?: string }
> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT 1 FROM worker_profiles WHERE id = ${input.workerProfileId} FOR UPDATE`
    );

    const [profile] = await tx
      .select({
        isVerified: workerProfiles.isVerified,
        verificationStatus: workerProfiles.verificationStatus,
        photoKey: workerProfiles.photoKey,
        photoUrl: workerProfiles.photoUrl,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.id, input.workerProfileId))
      .limit(1);

    if (!profile) {
      return {
        success: false,
        error: "profile_not_found",
        userMessage: "Worker profile not found",
      };
    }

    const [approvedResult] = await tx
      .select({ count: count() })
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.workerProfileId, input.workerProfileId),
          eq(profilePhotos.moderationStatus, "approved")
        )
      );

    const [pendingResult] = await tx
      .select({ count: count() })
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.workerProfileId, input.workerProfileId),
          eq(profilePhotos.moderationStatus, "pending")
        )
      );

    const limitCheck = checkPhotoLimits(
      approvedResult?.count ?? 0,
      pendingResult?.count ?? 0,
      {
        isVerified: isWorkerIdentityVerified(profile),
        purpose: input.purpose,
        hasApprovedPrimary: hasApprovedPrimaryProfileImage(profile),
      }
    );

    if (!limitCheck.canUpload) {
      return {
        success: false,
        error: "upload_limit_reached",
        userMessage: limitCheck.reason,
      };
    }

    const row = await input.buildRow(limitCheck);

    const [photo] = await tx
      .insert(profilePhotos)
      .values({
        userId: input.userId,
        workerProfileId: input.workerProfileId,
        stagingKey: row.stagingKey,
        photoKey: row.photoKey,
        photoUrl: row.photoUrl,
        moderationStatus: row.moderationStatus,
        moderationReason: input.moderationReason,
        moderationConfidence: input.moderationConfidence,
        moderationCategories: input.moderationCategories,
        displayOrder: limitCheck.currentApprovedCount,
      })
      .returning();

    return { success: true, photo, limitCheck };
  });
}

async function analyzePrivateStagingPhoto(
  stagingKey: string
): Promise<Awaited<ReturnType<typeof analyzeProfilePhoto>>> {
  const signedUrl = await createModerationStagingSignedGet(stagingKey);
  return analyzeProfilePhoto(signedUrl);
}

async function analyzePrivateStagingPhotoQuietly(
  stagingKey: string
): Promise<Awaited<ReturnType<typeof analyzeProfilePhoto>>> {
  try {
    return await analyzePrivateStagingPhoto(stagingKey);
  } catch {
    return {
      categories: ["unknown"],
      confidence: 0,
      rawLabels: [],
    };
  }
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

export async function persistApprovedPhotoOrRollbackPublicObject(
  persist: () => Promise<void>,
  publicPhotoKey: string,
  rollbackPublicObject: (
    photoKey: string | null
  ) => Promise<void> = deletePublicPhotoQuietly
): Promise<{ success: boolean; error?: string }> {
  try {
    await persist();
    return { success: true };
  } catch {
    await rollbackPublicObject(publicPhotoKey);
    return { success: false, error: "Could not approve photo" };
  }
}

export async function submitPhotoForModeration(
  userId: string,
  workerProfileId: string,
  stagingKey: string,
  options: { purpose?: PhotoUploadPurpose } = {}
): Promise<PhotoUploadResult> {
  assertOwnedPhotoStagingKey(userId, stagingKey);

  const purpose = options.purpose ?? "primary";
  const analysis = await analyzePrivateStagingPhotoQuietly(stagingKey);
  const decision = decidePhotoSubmission(analysis);
  const persistence = pendingPhotoPersistence(stagingKey);

  const inserted = await insertProfilePhotoWithSlotLock({
    userId,
    workerProfileId,
    purpose,
    moderationReason: decision.reason,
    moderationConfidence: Math.round(analysis.confidence * 100),
    moderationCategories: analysis.categories,
    buildRow: async () => ({
      stagingKey: persistence.stagingKey,
      photoKey: persistence.photoKey,
      photoUrl: persistence.photoUrl,
      moderationStatus: persistence.moderationStatus,
    }),
  });

  if (!inserted.success) {
    return {
      success: false,
      error: inserted.error,
      userMessage: inserted.userMessage,
    };
  }

  return {
    success: true,
    photoId: inserted.photo.id,
    status: inserted.photo.moderationStatus,
    decision,
    userMessage: getUserMessage(inserted.photo.moderationStatus),
    photoKey: inserted.photo.photoKey,
    photoUrl: inserted.photo.photoUrl,
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

  const persisted = await persistApprovedPhotoOrRollbackPublicObject(
    async () => {
      await db.transaction(async (tx) => {
        await tx
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

        const [approvedPhoto] = await tx
          .select()
          .from(profilePhotos)
          .where(eq(profilePhotos.id, photoId))
          .limit(1);

        if (approvedPhoto && hasApprovedPublicPhoto(approvedPhoto)) {
          const [approvedCount] = await tx
            .select({ count: count() })
            .from(profilePhotos)
            .where(
              and(
                eq(profilePhotos.workerProfileId, photo.workerProfileId),
                eq(profilePhotos.moderationStatus, "approved")
              )
            );

          if ((approvedCount?.count ?? 0) === 1) {
            await tx
              .update(profilePhotos)
              .set({ isCurrentApproved: true, updatedAt: new Date() })
              .where(eq(profilePhotos.id, approvedPhoto.id));

            await tx
              .update(workerProfiles)
              .set({
                photoKey: approvedPhoto.photoKey,
                photoUrl: approvedPhoto.photoUrl,
                updatedAt: new Date(),
              })
              .where(eq(workerProfiles.id, photo.workerProfileId));
          }
        }
      });
    },
    promoted.photoKey
  );

  if (!persisted.success) {
    return persisted;
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
      moderationReason: reason?.trim() || PHOTO_POLICY_COPY.rejected,
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

  return sortOwnedPhotos(photos.filter(hasApprovedPublicPhoto));
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
    const photos = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.workerProfileId, workerProfileId))
      .orderBy(profilePhotos.displayOrder);
    return sortOwnedPhotos(photos);
  }

  return getApprovedPhotosForWorker(workerProfileId);
}

function sortOwnedPhotos(photos: ProfilePhoto[]): ProfilePhoto[] {
  return [...photos].sort((left, right) => {
    if (left.isCurrentApproved !== right.isCurrentApproved) {
      return left.isCurrentApproved ? -1 : 1;
    }
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export async function setCurrentApprovedPhoto(
  workerProfileId: string,
  photoId: string
): Promise<{ success: boolean; error?: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT 1 FROM worker_profiles WHERE id = ${workerProfileId} FOR UPDATE`
    );

    const [photo] = await tx
      .select()
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.id, photoId),
          eq(profilePhotos.workerProfileId, workerProfileId)
        )
      )
      .limit(1);

    if (!photo) {
      return { success: false, error: "Photo not found or not approved" };
    }

    if (photo.moderationStatus === "pending") {
      return { success: false, error: "Pending photos cannot become primary" };
    }

    if (photo.moderationStatus === "rejected") {
      return { success: false, error: "Rejected photos cannot become primary" };
    }

    if (!hasApprovedPublicPhoto(photo)) {
      return { success: false, error: "Photo not found or not approved" };
    }

    await tx
      .update(profilePhotos)
      .set({ isCurrentApproved: false, updatedAt: new Date() })
      .where(eq(profilePhotos.workerProfileId, workerProfileId));

    await tx
      .update(profilePhotos)
      .set({ isCurrentApproved: true, updatedAt: new Date() })
      .where(eq(profilePhotos.id, photoId));

    await tx
      .update(workerProfiles)
      .set({
        photoKey: photo.photoKey,
        photoUrl: photo.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerProfileId));

    return { success: true };
  });
}

export function toOwnedPhotoDto(
  photo: ProfilePhoto,
  previewUrl: string | null = null
): {
  id: string;
  photoUrl: string | null;
  previewUrl: string | null;
  moderationStatus: PhotoModerationStatus;
  moderationReason: string | null;
  displayOrder: number;
  isCurrentApproved: boolean;
  createdAt: string;
} {
  const publicUrl =
    photo.moderationStatus === "approved" && hasApprovedPublicPhoto(photo)
      ? photo.photoUrl
      : null;

  return {
    id: photo.id,
    photoUrl: publicUrl,
    previewUrl: publicUrl ? null : previewUrl,
    moderationStatus: photo.moderationStatus,
    moderationReason:
      photo.moderationStatus === "rejected" && photo.moderationReviewedBy
        ? photo.moderationReason
        : null,
    displayOrder: photo.displayOrder,
    isCurrentApproved: photo.isCurrentApproved,
    createdAt: photo.createdAt.toISOString(),
  };
}

async function ownerPendingPreviewUrl(
  photo: ProfilePhoto
): Promise<string | null> {
  if (photo.moderationStatus !== "pending" || !photo.stagingKey) {
    return null;
  }

  try {
    return await getSignedPhotoStagingUrlForOwner(
      photo.userId,
      photo.stagingKey,
      120
    );
  } catch {
    return null;
  }
}

export async function getOwnedPhotosForWorker(
  workerProfileId: string
): Promise<ReturnType<typeof toOwnedPhotoDto>[]> {
  const photos = await getWorkerPhotos(workerProfileId, true);
  return Promise.all(
    photos.map(async (photo) =>
      toOwnedPhotoDto(photo, await ownerPendingPreviewUrl(photo))
    )
  );
}

export async function hasSubmittedProfilePhoto(
  workerProfileId: string
): Promise<boolean> {
  const [row] = await db
    .select({ count: count() })
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, workerProfileId),
        inArray(profilePhotos.moderationStatus, ["pending", "approved"])
      )
    );

  return (row?.count ?? 0) > 0;
}

export async function getOwnerPendingPhotoPreview(
  photoId: string,
  userId: string
): Promise<{ previewUrl: string } | { error: string; status: number }> {
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.userId, userId)))
    .limit(1);

  if (!photo) {
    return { error: "Photo not found", status: 404 };
  }

  if (photo.moderationStatus !== "pending" || !photo.stagingKey) {
    return { error: "Preview unavailable", status: 404 };
  }

  try {
    const previewUrl = await getSignedPhotoStagingUrlForOwner(
      userId,
      photo.stagingKey,
      120
    );
    return { previewUrl };
  } catch {
    return { error: "Preview unavailable", status: 404 };
  }
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
    return { success: false, error: PHOTO_POLICY_COPY.primaryLocked };
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
  GALLERY_PRIMARY_PENDING_REASON,
};
