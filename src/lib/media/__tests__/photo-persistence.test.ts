import { describe, expect, it } from "vitest";
import {
  approvedPhotoPersistence,
  canUpdateWorkerProfileFromPhoto,
  hasApprovedPrimaryProfileImage,
  hasApprovedPublicPhoto,
  pendingPhotoPersistence,
  persistenceForModerationDecision,
  promotionFailedFallback,
  rejectedPhotoPersistence,
  shouldReplaceWorkerProfilePhotoOnDelete,
} from "../photo-persistence";

const STAGING_KEY = "profile-photo-staging/user-1/photo.jpeg";
const PUBLIC_KEY = "profiles/user-1/photo.jpeg";
const PUBLIC_URL = "https://media.example.com/profiles/user-1/photo.jpeg";

describe("profile photo persistence", () => {
  it("keeps pending photos in private staging with no public URL", () => {
    const pending = pendingPhotoPersistence(STAGING_KEY);
    expect(pending.stagingKey).toBe(STAGING_KEY);
    expect(pending.photoKey).toBeNull();
    expect(pending.photoUrl).toBeNull();
    expect(pending.moderationStatus).toBe("pending");
    expect(pending.writesPublicObject).toBe(false);
    expect(pending.deletesStagingObject).toBe(false);
  });

  it("never creates a public object for rejected photos and deletes staging", () => {
    const rejected = rejectedPhotoPersistence();
    expect(rejected.stagingKey).toBeNull();
    expect(rejected.photoKey).toBeNull();
    expect(rejected.photoUrl).toBeNull();
    expect(rejected.moderationStatus).toBe("rejected");
    expect(rejected.writesPublicObject).toBe(false);
    expect(rejected.deletesStagingObject).toBe(true);
  });

  it("persists approved photos only after a public object and CDN URL exist", () => {
    const approved = approvedPhotoPersistence(PUBLIC_KEY, PUBLIC_URL);
    expect(approved.stagingKey).toBeNull();
    expect(approved.photoKey).toBe(PUBLIC_KEY);
    expect(approved.photoUrl).toBe(PUBLIC_URL);
    expect(approved.moderationStatus).toBe("approved");
    expect(approved.writesPublicObject).toBe(true);
    expect(approved.deletesStagingObject).toBe(true);
  });

  it("does not mark a photo approved when promotion fails", () => {
    const fallback = promotionFailedFallback(STAGING_KEY);
    expect(fallback).toEqual(pendingPhotoPersistence(STAGING_KEY));
    expect(fallback.moderationStatus).toBe("pending");
    expect(fallback.photoUrl).toBeNull();
    expect(fallback.writesPublicObject).toBe(false);
  });

  it("maps moderation decisions onto the locked storage model", () => {
    expect(
      persistenceForModerationDecision("pending", STAGING_KEY, null)
    ).toEqual(pendingPhotoPersistence(STAGING_KEY));
    expect(
      persistenceForModerationDecision("rejected", STAGING_KEY, null)
    ).toEqual(rejectedPhotoPersistence());
    expect(
      persistenceForModerationDecision("approved", STAGING_KEY, {
        photoKey: PUBLIC_KEY,
        photoUrl: PUBLIC_URL,
      })
    ).toEqual(approvedPhotoPersistence(PUBLIC_KEY, PUBLIC_URL));
    expect(
      persistenceForModerationDecision("approved", STAGING_KEY, null)
    ).toEqual(pendingPhotoPersistence(STAGING_KEY));
  });

  it("does not update the worker profile from pending or rejected rows", () => {
    expect(
      canUpdateWorkerProfileFromPhoto({
        moderationStatus: "pending",
        isCurrentApproved: false,
        photoKey: null,
        photoUrl: null,
      })
    ).toBe(false);
    expect(
      shouldReplaceWorkerProfilePhotoOnDelete({
        moderationStatus: "rejected",
        isCurrentApproved: false,
        photoKey: null,
        photoUrl: null,
      })
    ).toBe(false);
    expect(
      hasApprovedPublicPhoto({
        moderationStatus: "approved",
        photoKey: PUBLIC_KEY,
        photoUrl: PUBLIC_URL,
      })
    ).toBe(true);
    expect(
      shouldReplaceWorkerProfilePhotoOnDelete({
        moderationStatus: "approved",
        isCurrentApproved: true,
        photoKey: PUBLIC_KEY,
        photoUrl: PUBLIC_URL,
      })
    ).toBe(true);
  });

  it("requires both public photoKey and photoUrl for a live primary image", () => {
    expect(
      hasApprovedPrimaryProfileImage({
        photoKey: PUBLIC_KEY,
        photoUrl: PUBLIC_URL,
      })
    ).toBe(true);
    expect(
      hasApprovedPrimaryProfileImage({
        photoKey: null,
        photoUrl: PUBLIC_URL,
      })
    ).toBe(false);
  });
});
