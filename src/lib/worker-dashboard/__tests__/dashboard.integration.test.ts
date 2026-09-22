/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { localDatabaseUrl } from "../../db/local-config";
import { parseDatabaseUrl } from "../../db/safety";
import { migrateLocalDb, startLocalDb } from "../../../../scripts/local-db";

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

describe.skipIf(!shouldRun)("worker dashboard and gallery against paid_talent_test", () => {
  let createUserWithRole: typeof import("../../auth/create-account").createUserWithRole;
  let db: typeof import("../../db").db;
  let profileViews: typeof import("../../db").profileViews;
  let profileInterests: typeof import("../../db").profileInterests;
  let profilePhotos: typeof import("../../db").profilePhotos;
  let workerProfiles: typeof import("../../db").workerProfiles;
  let recruiterProfiles: typeof import("../../db").recruiterProfiles;
  let getWorkerDashboardData: typeof import("../queries").getWorkerDashboardData;
  let getOwnWorkerPreview: typeof import("../../worker-profile/preview").getOwnWorkerPreview;
  let canUploadPhoto: typeof import("../../moderation/photo-moderation").canUploadPhoto;
  let getApprovedPhotosForWorker: typeof import("../../moderation/photo-moderation").getApprovedPhotosForWorker;
  let deletePhoto: typeof import("../../moderation/photo-moderation").deletePhoto;
  let insertProfilePhotoWithSlotLock: typeof import("../../moderation/photo-moderation").insertProfilePhotoWithSlotLock;
  let rejectPhoto: typeof import("../../moderation/photo-moderation").rejectPhoto;
  let checkPhotoLimits: typeof import("../../moderation/photo-policy").checkPhotoLimits;
  let inferPendingPhotoSubmissionKind: typeof import("../../moderation/photo-policy").inferPendingPhotoSubmissionKind;

  let workerAId = "";
  let workerAProfileId = "";
  let workerBId = "";
  let workerBProfileId = "";
  let recruiterId = "";
  let recruiterBId = "";

  beforeAll(async () => {
    await startLocalDb("test");
    await migrateLocalDb("test");
    process.env.DATABASE_URL = TEST_URL;
    expect(isLocalTestDatabase(process.env.DATABASE_URL)).toBe(true);
    vi.resetModules();
    vi.doUnmock("@/lib/db");

    ({ createUserWithRole } = await import("../../auth/create-account"));
    ({
      db,
      profileViews,
      profileInterests,
      profilePhotos,
      workerProfiles,
      recruiterProfiles,
    } = await import("../../db"));
    ({ getWorkerDashboardData } = await import("../queries"));
    ({ getOwnWorkerPreview } = await import("../../worker-profile/preview"));
    ({
      canUploadPhoto,
      getApprovedPhotosForWorker,
      deletePhoto,
      insertProfilePhotoWithSlotLock,
      rejectPhoto,
    } = await import("../../moderation/photo-moderation"));
    ({ checkPhotoLimits, inferPendingPhotoSubmissionKind } = await import(
      "../../moderation/photo-policy"
    ));

    const workerA = await createUserWithRole({
      email: `dash-a-${suffix}@example.com`,
      name: "Dash Worker A",
      role: "worker",
      ageVerified: true,
    });
    const workerB = await createUserWithRole({
      email: `dash-b-${suffix}@example.com`,
      name: "Dash Worker B",
      role: "worker",
      ageVerified: true,
    });
    const recruiter = await createUserWithRole({
      email: `dash-rec-${suffix}@example.com`,
      name: "Dash Recruiter",
      role: "recruiter",
      ageVerified: true,
    });
    const recruiterB = await createUserWithRole({
      email: `dash-rec-b-${suffix}@example.com`,
      name: "Other Recruiter",
      role: "recruiter",
      ageVerified: true,
    });

    workerAId = workerA.id;
    workerBId = workerB.id;
    recruiterId = recruiter.id;
    recruiterBId = recruiterB.id;

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

    await db
      .update(workerProfiles)
      .set({
        isVerified: true,
        verificationStatus: "verified",
        isPublished: true,
        displayName: "Dash Worker A",
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerAProfileId));

    await db
      .update(recruiterProfiles)
      .set({
        organizationName: "Sky Bar",
        logoUrl: "https://cdn.example/venues/sky.png",
        updatedAt: new Date(),
      })
      .where(eq(recruiterProfiles.userId, recruiterId));
  }, 120000);

  afterAll(async () => {
    if (!workerAProfileId) return;
    await db.delete(profileViews).where(eq(profileViews.workerProfileId, workerAProfileId));
    await db.delete(profileViews).where(eq(profileViews.workerProfileId, workerBProfileId));
    await db.delete(profileInterests).where(eq(profileInterests.workerProfileId, workerAProfileId));
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerBProfileId));
  });

  it("counts recruiter profile views and interests from the database", async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 2);
    const old = new Date();
    old.setDate(old.getDate() - 40);

    await db.insert(profileViews).values([
      {
        workerProfileId: workerAProfileId,
        viewerUserId: recruiterId,
        viewedAt: recent,
      },
      {
        workerProfileId: workerAProfileId,
        viewerUserId: recruiterId,
        viewedAt: recent,
      },
      {
        workerProfileId: workerAProfileId,
        viewerUserId: recruiterBId,
        viewedAt: recent,
      },
      {
        workerProfileId: workerAProfileId,
        viewerUserId: recruiterId,
        viewedAt: old,
      },
      {
        workerProfileId: workerBProfileId,
        viewerUserId: recruiterId,
        viewedAt: recent,
      },
    ]);

    await db.insert(profileInterests).values({
      recruiterUserId: recruiterId,
      workerProfileId: workerAProfileId,
      message: "Loved your profile",
    });

    const first = await getWorkerDashboardData(workerAId);
    expect(first.stats.uniqueRecruiterViewersLast30Days).toBe(2);
    expect(first.stats.profileViewEventsLast30Days).toBe(3);
    expect(first.stats.interestReceivedCount).toBe(1);
    expect(first.recentInterests[0]?.venueName).toBe("Sky Bar");
    expect(first.recentInterests[0]?.logoUrl).toBe(
      "https://cdn.example/venues/sky.png"
    );
    expect(first.recentInterests[0]?.message).toBe("Loved your profile");
    expect(first.profile).not.toHaveProperty("idDocumentKey");
    expect(first.profile).not.toHaveProperty("livenessVideoKey");
    expect(first.profile).not.toHaveProperty("challengeCode");
    expect(first.profile).not.toHaveProperty("verificationReviewedBy");

    const second = await getWorkerDashboardData(workerAId);
    expect(second.stats).toEqual(first.stats);

    const other = await getWorkerDashboardData(workerBId);
    expect(other.stats.uniqueRecruiterViewersLast30Days).toBe(1);
    expect(other.stats.interestReceivedCount).toBe(0);
    expect(other.recentInterests).toHaveLength(0);
  });

  it("does not treat worker self-preview as a recruiter profile view", async () => {
    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profileViews)
      .where(eq(profileViews.workerProfileId, workerAProfileId));

    const preview = await getOwnWorkerPreview(workerAId);
    expect(preview?.id).toBe(workerAProfileId);
    expect(preview?.displayName).toBe("Dash Worker A");

    const otherPreview = await getOwnWorkerPreview(workerBId);
    expect(otherPreview?.id).toBe(workerBProfileId);
    expect(otherPreview?.id).not.toBe(workerAProfileId);

    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profileViews)
      .where(eq(profileViews.workerProfileId, workerAProfileId));

    expect(after).toBe(before);
  });

  it("blocks gallery uploads until identity is verified and a public primary exists", async () => {
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));
    await db
      .update(workerProfiles)
      .set({ photoKey: null, photoUrl: null, updatedAt: new Date() })
      .where(eq(workerProfiles.id, workerAProfileId));

    expect((await canUploadPhoto(workerAProfileId, "gallery")).canUpload).toBe(false);
    expect((await canUploadPhoto(workerAProfileId, "primary")).canUpload).toBe(true);

    const pendingPrimary = await insertProfilePhotoWithSlotLock({
      userId: workerAId,
      workerProfileId: workerAProfileId,
      purpose: "primary",
      moderationReason: "manual review",
      moderationConfidence: 90,
      moderationCategories: ["safe"],
      buildRow: async () => ({
        stagingKey: `profile-photo-staging/${workerAId}/replacement.jpg`,
        photoKey: null,
        photoUrl: null,
        moderationStatus: "pending",
      }),
    });
    expect(pendingPrimary.success).toBe(true);
    if (!pendingPrimary.success) return;

    expect((await canUploadPhoto(workerAProfileId, "gallery")).canUpload).toBe(false);
    expect(
      inferPendingPhotoSubmissionKind({ photoKey: null, photoUrl: null })
    ).toBe("primary");

    const rejected = await rejectPhoto(
      pendingPrimary.photo.id,
      "admin@example.com",
      "Please upload a clear face-forward photo."
    );
    expect(rejected.success).toBe(true);

    expect((await canUploadPhoto(workerAProfileId, "gallery")).canUpload).toBe(false);
    expect((await canUploadPhoto(workerAProfileId, "primary")).canUpload).toBe(true);

    const replacement = await insertProfilePhotoWithSlotLock({
      userId: workerAId,
      workerProfileId: workerAProfileId,
      purpose: "primary",
      moderationReason: "manual review",
      moderationConfidence: 90,
      moderationCategories: ["safe"],
      buildRow: async () => ({
        stagingKey: `profile-photo-staging/${workerAId}/replacement-2.jpg`,
        photoKey: null,
        photoUrl: null,
        moderationStatus: "pending",
      }),
    });
    expect(replacement.success).toBe(true);

    expect((await canUploadPhoto(workerBProfileId, "gallery")).canUpload).toBe(false);
  });

  it("enforces the five-slot gallery limit and ownership on delete", async () => {
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));
    await db.insert(profilePhotos).values([
      {
        userId: workerAId,
        workerProfileId: workerAProfileId,
        photoKey: `profiles/${workerAId}/primary.jpg`,
        photoUrl: "https://cdn.example/primary.jpg",
        moderationStatus: "approved",
        displayOrder: 0,
        isCurrentApproved: true,
      },
      {
        userId: workerAId,
        workerProfileId: workerAProfileId,
        photoKey: `profiles/${workerAId}/pending.jpg`,
        photoUrl: null,
        stagingKey: `staging/${workerAId}/pending.jpg`,
        moderationStatus: "pending",
        displayOrder: 1,
        isCurrentApproved: false,
      },
    ]);

    await db
      .update(workerProfiles)
      .set({
        photoKey: `profiles/${workerAId}/primary.jpg`,
        photoUrl: "https://cdn.example/primary.jpg",
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerAProfileId));

    const unverifiedGallery = checkPhotoLimits(1, 0, {
      purpose: "gallery",
      isVerified: false,
    });
    expect(unverifiedGallery.canUpload).toBe(false);

    const pendingGalleryAllowed = await canUploadPhoto(workerAProfileId, "gallery");
    expect(pendingGalleryAllowed.canUpload).toBe(true);

    const primaryWhilePending = await canUploadPhoto(workerAProfileId, "primary");
    expect(primaryWhilePending.canUpload).toBe(false);

    await db
      .delete(profilePhotos)
      .where(
        and(
          eq(profilePhotos.workerProfileId, workerAProfileId),
          eq(profilePhotos.moderationStatus, "pending")
        )
      );

    const extra = Array.from({ length: 4 }, (_, index) => ({
      userId: workerAId,
      workerProfileId: workerAProfileId,
      photoKey: `profiles/${workerAId}/g${index}.jpg`,
      photoUrl: `https://cdn.example/g${index}.jpg`,
      moderationStatus: "approved" as const,
      displayOrder: index + 1,
      isCurrentApproved: false,
    }));
    await db.insert(profilePhotos).values(extra);

    const atCap = await canUploadPhoto(workerAProfileId, "gallery");
    expect(atCap.canUpload).toBe(false);
    expect(atCap.currentApprovedCount).toBe(5);

    const publicPhotos = await getApprovedPhotosForWorker(workerAProfileId);
    expect(publicPhotos.every((photo) => photo.moderationStatus === "approved")).toBe(
      true
    );
    expect(publicPhotos.every((photo) => Boolean(photo.photoUrl))).toBe(true);

    const [foreign] = await db
      .insert(profilePhotos)
      .values({
        userId: workerBId,
        workerProfileId: workerBProfileId,
        photoKey: `profiles/${workerBId}/other.jpg`,
        photoUrl: "https://cdn.example/other.jpg",
        moderationStatus: "approved",
        displayOrder: 0,
        isCurrentApproved: true,
      })
      .returning();

    const stolen = await deletePhoto(foreign.id, workerAId);
    expect(stolen.success).toBe(false);

    const [galleryPhoto] = await db
      .select({ id: profilePhotos.id })
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.workerProfileId, workerAProfileId),
          eq(profilePhotos.isCurrentApproved, false)
        )
      )
      .limit(1);

    const removed = await deletePhoto(galleryPhoto.id, workerAId);
    expect(removed.success).toBe(true);

    const afterRemoval = await canUploadPhoto(workerAProfileId, "gallery");
    expect(afterRemoval.canUpload).toBe(true);

    const rejectedInsert = await db
      .insert(profilePhotos)
      .values({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        moderationStatus: "rejected",
        moderationReason: "Did not meet guidelines",
        displayOrder: 9,
        isCurrentApproved: false,
      })
      .returning();

    const afterRejected = await canUploadPhoto(workerAProfileId, "gallery");
    expect(afterRejected.canUpload).toBe(true);

    const replaced = await deletePhoto(rejectedInsert[0].id, workerAId);
    expect(replaced.success).toBe(true);
  });

  it("serializes concurrent gallery submissions against the last remaining slot", async () => {
    await db.delete(profilePhotos).where(eq(profilePhotos.workerProfileId, workerAProfileId));

    await db.insert(profilePhotos).values(
      Array.from({ length: 4 }, (_, index) => ({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        photoKey: `profiles/${workerAId}/slot-${index}.jpg`,
        photoUrl: `https://cdn.example/slot-${index}.jpg`,
        moderationStatus: "approved" as const,
        displayOrder: index,
        isCurrentApproved: index === 0,
      }))
    );

    await db
      .update(workerProfiles)
      .set({
        photoKey: `profiles/${workerAId}/slot-0.jpg`,
        photoUrl: "https://cdn.example/slot-0.jpg",
        updatedAt: new Date(),
      })
      .where(eq(workerProfiles.id, workerAProfileId));

    const results = await Promise.all([
      insertProfilePhotoWithSlotLock({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        purpose: "gallery",
        moderationReason: "test",
        moderationConfidence: 90,
        moderationCategories: ["safe"],
        buildRow: async () => ({
          stagingKey: `staging/${workerAId}/race-a.jpg`,
          photoKey: null,
          photoUrl: null,
          moderationStatus: "pending",
        }),
      }),
      insertProfilePhotoWithSlotLock({
        userId: workerAId,
        workerProfileId: workerAProfileId,
        purpose: "gallery",
        moderationReason: "test",
        moderationConfidence: 90,
        moderationCategories: ["safe"],
        buildRow: async () => ({
          stagingKey: `staging/${workerAId}/race-b.jpg`,
          photoKey: null,
          photoUrl: null,
          moderationStatus: "pending",
        }),
      }),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toHaveLength(1);

    const [{ occupied }] = await db
      .select({
        occupied: sql<number>`count(*)::int`,
      })
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.workerProfileId, workerAProfileId),
          sql`${profilePhotos.moderationStatus} in ('approved', 'pending')`
        )
      );

    expect(Number(occupied)).toBeLessThanOrEqual(5);
    expect(Number(occupied)).toBe(5);
  });
});
