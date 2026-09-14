import type { PhotoModerationStatus } from "@/lib/db/schema";

export interface ProfilePhotoPersistence {
  stagingKey: string | null;
  photoKey: string | null;
  photoUrl: string | null;
  moderationStatus: PhotoModerationStatus;
  writesPublicObject: boolean;
  deletesStagingObject: boolean;
}

export function pendingPhotoPersistence(
  stagingKey: string
): ProfilePhotoPersistence {
  return {
    stagingKey,
    photoKey: null,
    photoUrl: null,
    moderationStatus: "pending",
    writesPublicObject: false,
    deletesStagingObject: false,
  };
}

export function rejectedPhotoPersistence(): ProfilePhotoPersistence {
  return {
    stagingKey: null,
    photoKey: null,
    photoUrl: null,
    moderationStatus: "rejected",
    writesPublicObject: false,
    deletesStagingObject: true,
  };
}

export function approvedPhotoPersistence(
  photoKey: string,
  photoUrl: string
): ProfilePhotoPersistence {
  return {
    stagingKey: null,
    photoKey,
    photoUrl,
    moderationStatus: "approved",
    writesPublicObject: true,
    deletesStagingObject: true,
  };
}

export function promotionFailedFallback(
  stagingKey: string
): ProfilePhotoPersistence {
  return pendingPhotoPersistence(stagingKey);
}

export function persistenceForModerationDecision(
  status: PhotoModerationStatus,
  stagingKey: string,
  promoted: { photoKey: string; photoUrl: string } | null
): ProfilePhotoPersistence {
  if (status === "rejected") {
    return rejectedPhotoPersistence();
  }

  if (status === "pending") {
    return pendingPhotoPersistence(stagingKey);
  }

  if (promoted?.photoKey && promoted.photoUrl) {
    return approvedPhotoPersistence(promoted.photoKey, promoted.photoUrl);
  }

  return promotionFailedFallback(stagingKey);
}

export function canUpdateWorkerProfileFromPhoto(photo: {
  moderationStatus: PhotoModerationStatus;
  isCurrentApproved: boolean;
  photoKey: string | null;
  photoUrl: string | null;
}): boolean {
  return (
    photo.moderationStatus === "approved" &&
    photo.isCurrentApproved &&
    Boolean(photo.photoKey) &&
    Boolean(photo.photoUrl)
  );
}

export function shouldReplaceWorkerProfilePhotoOnDelete(photo: {
  moderationStatus: PhotoModerationStatus;
  isCurrentApproved: boolean;
  photoKey: string | null;
  photoUrl: string | null;
}): boolean {
  return canUpdateWorkerProfileFromPhoto(photo);
}

export function hasApprovedPublicPhoto(photo: {
  moderationStatus: PhotoModerationStatus;
  photoKey: string | null;
  photoUrl: string | null;
}): boolean {
  return (
    photo.moderationStatus === "approved" &&
    Boolean(photo.photoKey) &&
    Boolean(photo.photoUrl)
  );
}
