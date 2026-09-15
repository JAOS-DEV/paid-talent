import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  buildPhotoSlots,
  emptyDashboardStats,
  profileViewWindowStart,
  toDashboardSafeProfile,
  toDashboardStats,
  toSlotCount,
} from "../index";

describe("worker dashboard metrics helpers", () => {
  it("uses a 30-day profile view window", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const start = profileViewWindowStart(now);
    expect(start.toISOString()).toBe("2026-08-16T12:00:00.000Z");
  });

  it("displays unique recruiter viewers as the primary profile-views metric", () => {
    const stats = toDashboardStats(
      {
        windowDays: 30,
        viewEventsLast30Days: 9,
        uniqueRecruiterViewersLast30Days: 3,
      },
      2
    );

    expect(stats.profileViewsLast30Days).toBe(3);
    expect(stats.profileViewEventsLast30Days).toBe(9);
    expect(stats.interestReceivedCount).toBe(2);
  });

    it("does not count rejected photos toward gallery slots", () => {
    expect(toSlotCount(2, 1)).toBe(3);
    const slots = buildPhotoSlots({
      approvedCount: 2,
      pendingCount: 1,
      isVerified: true,
      hasApprovedPrimary: true,
    });
    expect(slots.slotCount).toBe(3);
    expect(slots.remainingSlots).toBe(2);
    expect(slots.canAddGalleryPhoto).toBe(true);
  });

  it("does not allow gallery photos before an approved primary exists", () => {
    const slots = buildPhotoSlots({
      approvedCount: 0,
      pendingCount: 1,
      isVerified: true,
      hasApprovedPrimary: false,
    });
    expect(slots.canAddGalleryPhoto).toBe(false);
  });

  it("starts empty stats at zero instead of fabricating counts", () => {
    expect(emptyDashboardStats()).toEqual({
      profileViewsLast30Days: 0,
      profileViewEventsLast30Days: 0,
      uniqueRecruiterViewersLast30Days: 0,
      interestReceivedCount: 0,
    });
  });

  it("omits private verification storage fields from the dashboard profile DTO", () => {
    const profile = toDashboardSafeProfile({
      photoUrl: "https://cdn.example/a.jpg",
      photoKey: "profiles/ada/a.jpg",
      displayName: "Ada",
      location: "Bangkok",
      availability: "Full-time",
      bio: "Bartender",
      jobRoles: ["Bartender"],
      experience: null,
      experienceYears: 3,
      languages: ["English"],
      lineId: null,
      whatsappNumber: null,
      phoneNumber: null,
      isPublished: true,
      isVerified: true,
      verificationStatus: "verified",
      hasSubmittedPhoto: true,
    });

    expect(profile).not.toHaveProperty("idDocumentKey");
    expect(profile).not.toHaveProperty("livenessVideoKey");
    expect(profile).not.toHaveProperty("challengeCode");
    expect(profile).not.toHaveProperty("challengeIssuedAt");
    expect(profile).not.toHaveProperty("idDocumentSubmittedAt");
    expect(profile).not.toHaveProperty("verificationReviewedAt");
    expect(profile).not.toHaveProperty("verificationReviewedBy");
    expect(profile).not.toHaveProperty("photoKey");
  });

  it("does not return stagingKey from the worker media confirm response", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/media/upload/route.ts"),
      "utf8"
    );
    expect(source).not.toContain("stagingKey: key");
  });

  it("does not select private verification fields in the dashboard query", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/worker-dashboard/queries.ts"),
      "utf8"
    );
    expect(source).not.toContain("idDocumentKey");
    expect(source).not.toContain("livenessVideoKey");
    expect(source).not.toContain("challengeCode");
    expect(source).not.toContain("verificationReviewedBy");
  });
});
