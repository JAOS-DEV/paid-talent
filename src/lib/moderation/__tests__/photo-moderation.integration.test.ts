/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { localDatabaseUrl } from "../../db/local-config";
import { parseDatabaseUrl } from "../../db/safety";
import { migrateLocalDb, startLocalDb } from "../../../../scripts/local-db";

vi.mock("@/lib/storage/s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage/s3")>();
  return {
    ...actual,
    promoteStagedProfilePhotoToPublic: vi.fn(
      async (userId: string, stagingKey: string) => ({
        photoKey: `profiles/${userId}/${stagingKey.split("/").pop() ?? "photo.jpg"}`,
        photoUrl: `https://cdn.example/profiles/${userId}/${stagingKey.split("/").pop() ?? "photo.jpg"}`,
      })
    ),
    deleteFile: vi.fn(async () => undefined),
    deleteStagedProfilePhoto: vi.fn(async () => undefined),
    getSignedPhotoStagingUrlForOwner: vi.fn(
      async () => "https://signed.example/owner-preview.jpg"
    ),
  };
});

const TEST_URL = localDatabaseUrl("test");
const shouldRun = process.env.RUN_DOCKER_DB_TESTS === "1";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

function isLocalTestDatabase(url: string | undefined): boolean {
  const parsed = parseDatabaseUrl(url);
  return (
    parsed.ok &&
    parsed.parsed.local &&
    parsed.parsed.database === "paid_talent_test"
  );
}

describe.skipIf(!shouldRun)("manual profile photo moderation against paid_talent_test", () => {
  let createUserWithRole: typeof import("../../auth/create-account").createUserWithRole;
  let db: typeof import("../../db").db;
  let profilePhotos: typeof import("../../db").profilePhotos;
  let workerProfiles: typeof import("../../db").workerProfiles;
  let insertProfilePhotoWithSlotLock: typeof import("../photo-moderation").insertProfilePhotoWithSlotLock;
  let setCurrentApprovedPhoto: typeof import("../photo-moderation").setCurrentApprovedPhoto;
  let getPendingPhotosForReview: typeof import("../photo-moderation").getPendingPhotosForReview;
  let getApprovedPhotosForWorker: typeof import("../photo-moderation").getApprovedPhotosForWorker;
  let toOwnedPhotoDto: typeof import("../photo-moderation").toOwnedPhotoDto;
  let approvePhoto: typeof import("../photo-moderation").approvePhoto;
  let canUploadPhoto: typeof import("../photo-moderation").canUploadPhoto;
  let getOwnerPendingPhotoPreview: typeof import("../photo-moderation").getOwnerPendingPhotoPreview;
  let inferPendingPhotoSubmissionKind: typeof import("../photo-policy").inferPendingPhotoSubmissionKind;
  let isSearchableWorker: typeof import("../../verification").isSearchableWorker;

  let workerAId = "";
  let workerAProfileId = "";
  let workerBId = "";
  let workerBProfileId = "";

  beforeAll(async () => {
    await startLocalDb("test");
    await migrateLocalDb("test");
    process.env.DATABASE_URL = TEST_URL;
    expect(isLocalTestDatabase(process.env.DATABASE_URL)).toBe(true);
    vi.resetModules();
    vi.doUnmock("@/lib/db");

    ({ createUserWithRole } = await import("../../auth/create-account"));
    ({ db, profilePhotos, workerProfiles } = await import("../../db"));
    ({
      insertProfilePhotoWithSlotLock,
      setCurrentApprovedPhoto,
      getPendingPhotosForReview,
      getApprovedPhotosForWorker,
      toOwnedPhotoDto,
      approvePhoto,
      canUploadPhoto,
      getOwnerPendingPhotoPreview,
    } = await import("../photo-moderation"));
    ({ inferPendingPhotoSubmissionKind } = await import("../photo-policy"));
    ({ isSearchableWorker } = await import("../../verification"));

    const workerA = await createUserWithRole({
      email: `photo-a-${suffix}@example.com`,
      name: "Photo Worker A",
      role: "worker",
      ageVerified: true,
    });
    const workerB = await createUserWithRole({
      email: `photo-b-${suffix}@example.com`,
      name: "Photo Worker B",
      role: "worker",
      ageVerified: true,
    });

    workerAId = workerA.id;
    workerBId = workerB.id;

    const [profileA] = await db
      .select({ id: workerProfiles.id })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, workerAId))
      .limit(1);
    const [profileB] = await db
      .select({ id: workerProfiles.id })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, workerBId))
      .limit(1);

    workerAProfileId = profileA.id;
    workerBProfileId = profileB.id;
  });

  afterAll(async () => {
    if (!workerAProfileId) return;
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerBProfileId));
  });

  it("stores successful uploads as pending private photos", async () => {
    const inserted = await insertProfilePhotoWithSlotLock({
      userId: workerAId,
      workerProfileId: workerAProfileId,
      purpose: "primary",
      moderationReason: "Content meets guidelines",
      moderationConfidence: 92,
      moderationCategories: ["safe"],
      buildRow: async () => ({
        stagingKey: `profile-photo-staging/${workerAId}/primary.jpg`,
        photoKey: null,
        photoUrl: null,
        moderationStatus: "pending",
      }),
    });

    expect(inserted.success).toBe(true);
    if (!inserted.success) return;

    expect(inserted.photo.moderationStatus).toBe("pending");
    expect(inserted.photo.photoKey).toBeNull();
    expect(inserted.photo.photoUrl).toBeNull();
    expect(inserted.photo.stagingKey).toContain("profile-photo-staging/");

    const dto = toOwnedPhotoDto(inserted.photo);
    expect(dto).not.toHaveProperty("stagingKey");
    expect(dto.photoUrl).toBeNull();
    expect(dto.moderationReason).toBeNull();

    const queue = await getPendingPhotosForReview();
    expect(queue.some((photo) => photo.id === inserted.photo.id)).toBe(true);

    const publicPhotos = await getApprovedPhotosForWorker(workerAProfileId);
    expect(publicPhotos).toHaveLength(0);

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerAProfileId))
      .limit(1);

    await db
      .update(workerProfiles)
      .set({
        isVerified: true,
        verificationStatus: "verified",
        isPublished: true,
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerAProfileId));

    const [verified] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerAProfileId))
      .limit(1);

    expect(isSearchableWorker(verified)).toEqual({
      isSearchable: false,
      reason: "photo_pending",
    });
    expect(profile.photoUrl).toBeNull();
  });

  it("lets a worker switch primary among approved photos, but not pending/rejected/foreign", async () => {
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));

    const [primary] = await db
      .insert(profilePhotos)
      .values({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        photoKey: `profiles/${workerAId}/a.jpg`,
        photoUrl: "https://cdn.example/a.jpg",
        moderationStatus: "approved",
        displayOrder: 0,
        isCurrentApproved: true,
        moderationReviewedBy: "admin@example.com",
        moderationReviewedAt: new Date(),
      })
      .returning();

    const [gallery] = await db
      .insert(profilePhotos)
      .values({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        photoKey: `profiles/${workerAId}/b.jpg`,
        photoUrl: "https://cdn.example/b.jpg",
        moderationStatus: "approved",
        displayOrder: 1,
        isCurrentApproved: false,
        moderationReviewedBy: "admin@example.com",
        moderationReviewedAt: new Date(),
      })
      .returning();

    const [pending] = await db
      .insert(profilePhotos)
      .values({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        stagingKey: `profile-photo-staging/${workerAId}/c.jpg`,
        moderationStatus: "pending",
        displayOrder: 2,
        isCurrentApproved: false,
      })
      .returning();

    const [rejected] = await db
      .insert(profilePhotos)
      .values({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        moderationStatus: "rejected",
        moderationReason: "Please upload a clear face-forward photo.",
        moderationReviewedBy: "admin@example.com",
        displayOrder: 3,
        isCurrentApproved: false,
      })
      .returning();

    const [foreign] = await db
      .insert(profilePhotos)
      .values({
        userId: workerBId,
        workerProfileId: workerBProfileId,
        photoKey: `profiles/${workerBId}/x.jpg`,
        photoUrl: "https://cdn.example/x.jpg",
        moderationStatus: "approved",
        displayOrder: 0,
        isCurrentApproved: true,
      })
      .returning();

    await db
      .update(workerProfiles)
      .set({
        photoKey: primary.photoKey,
        photoUrl: primary.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerAProfileId));

    const switched = await setCurrentApprovedPhoto(workerAProfileId, gallery.id);
    expect(switched.success).toBe(true);

    const [updatedProfile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerAProfileId))
      .limit(1);
    expect(updatedProfile.photoUrl).toBe("https://cdn.example/b.jpg");
    expect(updatedProfile.photoKey).toBe(`profiles/${workerAId}/b.jpg`);

    const [oldPrimary] = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.id, primary.id))
      .limit(1);
    expect(oldPrimary.moderationStatus).toBe("approved");
    expect(oldPrimary.isCurrentApproved).toBe(false);

    expect((await setCurrentApprovedPhoto(workerAProfileId, pending.id)).success).toBe(
      false
    );
    expect((await setCurrentApprovedPhoto(workerAProfileId, rejected.id)).success).toBe(
      false
    );
    expect((await setCurrentApprovedPhoto(workerAProfileId, foreign.id)).success).toBe(
      false
    );
  });

  it("approves the first pending photo as primary and later gallery photos without replacing it", async () => {
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));
    await db
      .update(workerProfiles)
      .set({ photoKey: null, photoUrl: null, updatedAt: new Date() })
      .where(eq(workerProfiles.id, workerAProfileId));

    const first = await insertProfilePhotoWithSlotLock({
      userId: workerAId,
      workerProfileId: workerAProfileId,
      purpose: "primary",
      moderationReason: "manual review",
      moderationConfidence: 90,
      moderationCategories: ["safe"],
      buildRow: async () => ({
        stagingKey: `profile-photo-staging/${workerAId}/first.jpg`,
        photoKey: null,
        photoUrl: null,
        moderationStatus: "pending",
      }),
    });
    expect(first.success).toBe(true);
    if (!first.success) return;

    expect((await canUploadPhoto(workerAProfileId, "gallery")).canUpload).toBe(false);
    const ownerPreview = await getOwnerPendingPhotoPreview(first.photo.id, workerAId);
    expect("previewUrl" in ownerPreview).toBe(true);
    const foreignPreview = await getOwnerPendingPhotoPreview(first.photo.id, workerBId);
    expect("error" in foreignPreview).toBe(true);

    const approvedFirst = await approvePhoto(first.photo.id, "admin@example.com");
    expect(approvedFirst.success).toBe(true);

    const [profileAfterFirst] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerAProfileId))
      .limit(1);
    expect(profileAfterFirst.photoKey).toBeTruthy();
    expect(profileAfterFirst.photoUrl).toBeTruthy();
    expect(
      inferPendingPhotoSubmissionKind({
        photoKey: profileAfterFirst.photoKey,
        photoUrl: profileAfterFirst.photoUrl,
      })
    ).toBe("gallery");
    expect((await canUploadPhoto(workerAProfileId, "gallery")).canUpload).toBe(true);

    const gallery = await insertProfilePhotoWithSlotLock({
      userId: workerAId,
      workerProfileId: workerAProfileId,
      purpose: "gallery",
      moderationReason: "manual review",
      moderationConfidence: 90,
      moderationCategories: ["safe"],
      buildRow: async () => ({
        stagingKey: `profile-photo-staging/${workerAId}/gallery.jpg`,
        photoKey: null,
        photoUrl: null,
        moderationStatus: "pending",
      }),
    });
    expect(gallery.success).toBe(true);
    if (!gallery.success) return;

    const approvedGallery = await approvePhoto(gallery.photo.id, "admin@example.com");
    expect(approvedGallery.success).toBe(true);

    const [profileAfterGallery] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerAProfileId))
      .limit(1);
    expect(profileAfterGallery.photoKey).toBe(profileAfterFirst.photoKey);
    expect(profileAfterGallery.photoUrl).toBe(profileAfterFirst.photoUrl);

    const [galleryRow] = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.id, gallery.photo.id))
      .limit(1);
    expect(galleryRow.isCurrentApproved).toBe(false);
    expect(galleryRow.moderationStatus).toBe("approved");
  });
});
