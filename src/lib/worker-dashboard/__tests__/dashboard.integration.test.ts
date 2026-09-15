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
  let checkPhotoLimits: typeof import("../../moderation/photo-policy").checkPhotoLimits;

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
    } = await import("../../moderation/photo-moderation"));
    ({ checkPhotoLimits } = await import("../../moderation/photo-policy"));

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
    expect(first.recentInterests[0]?.message).toBe("Loved your profile");

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

  it("enforces the five-slot gallery limit and ownership on delete", async () => {
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

    const unverifiedGallery = checkPhotoLimits(1, 0, {
      purpose: "gallery",
      isVerified: false,
    });
    expect(unverifiedGallery.canUpload).toBe(false);

    const pendingBlocked = await canUploadPhoto(workerAProfileId, "gallery");
    expect(pendingBlocked.canUpload).toBe(false);

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
});
