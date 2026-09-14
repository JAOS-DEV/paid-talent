import { describe, expect, it } from "vitest";
import {
  calculateCompositeScore,
  isCompositeTopTalentScore,
} from "@/lib/helpers/ranking";
import { getProfileCompleteness } from "@/lib/profile";
import { countTopTalentFromPublishedProfiles } from "../published-top-talent";
import type { WorkerProfile } from "@/lib/db/schema";

function createProfile(
  id: string,
  overrides: Partial<WorkerProfile> = {}
): WorkerProfile {
  return {
    id,
    userId: `user-${id}`,
    photoKey: "photo",
    photoUrl: "https://cdn.example.com/photo.jpg",
    displayName: "Worker",
    location: "Bangkok",
    area: "Sukhumvit",
    description: null,
    bio: "Experienced hospitality professional with a complete profile.",
    availability: "Evenings",
    expectedPayMin: 800,
    expectedPayMax: 1200,
    payCurrency: "USD",
    jobRoles: ["bartender"],
    experience: "5 years",
    experienceYears: 5,
    languages: ["en"],
    lineId: "line-id",
    whatsappNumber: null,
    phoneNumber: null,
    isPublished: true,
    isVerified: true,
    verificationStatus: "verified",
    idDocumentKey: null,
    livenessVideoKey: null,
    challengeCode: null,
    challengeIssuedAt: null,
    idDocumentSubmittedAt: null,
    verificationReviewedAt: null,
    verificationReviewedBy: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
    ...overrides,
  };
}

describe("batched published Top Talent count", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("matches per-profile composite Top Talent classification", () => {
    const profiles = [
      createProfile("high"),
      createProfile("mid", {
        bio: null,
        experience: null,
        experienceYears: null,
        languages: [],
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      }),
      createProfile("low", {
        photoUrl: null,
        bio: null,
        location: null,
        availability: null,
        jobRoles: [],
        experience: null,
        languages: [],
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ];
    const uniqueViewsByProfileId = new Map([
      ["high", 20],
      ["mid", 4],
      ["low", 0],
    ]);
    const interestCountByProfileId = new Map([
      ["high", 12],
      ["mid", 1],
      ["low", 0],
    ]);

    const batched = countTopTalentFromPublishedProfiles(
      profiles,
      uniqueViewsByProfileId,
      interestCountByProfileId,
      now
    );

    const sequential = profiles.filter((profile) => {
      const completeness = getProfileCompleteness(profile);
      const score = calculateCompositeScore(
        completeness.progress,
        uniqueViewsByProfileId.get(profile.id) ?? 0,
        interestCountByProfileId.get(profile.id) ?? 0,
        profile.updatedAt,
        undefined,
        now
      );
      return isCompositeTopTalentScore(score.totalScore);
    }).length;

    expect(batched).toBe(sequential);
    expect(batched).toBeGreaterThan(0);
    expect(batched).toBeLessThan(profiles.length);
  });

  it("returns zero when no published profiles exist", () => {
    expect(
      countTopTalentFromPublishedProfiles([], new Map(), new Map(), now)
    ).toBe(0);
  });
});
