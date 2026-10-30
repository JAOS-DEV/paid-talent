import { describe, expect, it } from "vitest";
import type { WorkerProfile } from "@/lib/db/schema";
import {
  firstNameFromDisplayName,
  toRecruiterSearchWorkerDto,
  toRecruiterWorkerTeaserDto,
  toSearchWorkerResult,
  toWorkerProfileDetail,
} from "../worker-dto";

const SECRET_LINE = "secret_line_id_xyz";
const SECRET_WHATSAPP = "+66999888777";
const SECRET_PHONE = "+66811223344";
const SECRET_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function profileWithSecrets(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: "profile-1",
    userId: SECRET_USER_ID,
    photoKey: "profiles/user/a.jpg",
    photoUrl: "https://cdn.example/a.jpg",
    displayName: "Somchai Pattaya Extra",
    location: "Bangkok",
    area: "Sukhumvit",
    description: "Experienced server",
    bio: "Friendly and reliable",
    availability: ["Full-time"],
    expectedPayMin: 15000,
    expectedPayMax: null,
    expectedPayPeriod: "month",
    payCurrency: "THB",
    jobRoles: ["Server"],
    experience: "3 years hospitality",
    experienceYears: 3,
    languages: ["English", "Thai"],
    lineId: SECRET_LINE,
    whatsappNumber: SECRET_WHATSAPP,
    phoneNumber: SECRET_PHONE,
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("worker-dto teaser contract", () => {
  it("firstName takes the first whitespace-separated token", () => {
    expect(firstNameFromDisplayName("Somchai Pattaya Extra")).toBe("Somchai");
    expect(firstNameFromDisplayName("  Nattaya  B. ")).toBe("Nattaya");
  });

  it("teaser DTO JSON has pay and place but no photoUrl/photos/bio/userId/contact keys", () => {
    const teaser = toRecruiterWorkerTeaserDto(profileWithSecrets(), false);
    const json = JSON.stringify(teaser);

    expect(teaser.mode).toBe("teaser");
    expect(teaser.firstName).toBe("Somchai");
    expect(teaser.location).toBe("Bangkok");
    expect(teaser.area).toBe("Sukhumvit");
    expect(teaser.jobRoles).toEqual(["Server"]);
    expect(teaser.expectedPayMin).toBe(15000);
    expect(teaser.expectedPayPeriod).toBe("month");
    expect(teaser.payCurrency).toBe("THB");
    expect(teaser.teaserPhotoPath).toBe("/api/workers/profile-1/teaser-photo");

    expect(json).not.toContain("photoUrl");
    expect(json).not.toContain('"photos"');
    expect(json).not.toContain("bio");
    expect(json).not.toContain(SECRET_USER_ID);
    expect(json).not.toContain(SECRET_LINE);
    expect(json).not.toContain(SECRET_WHATSAPP);
    expect(json).not.toContain(SECRET_PHONE);
    expect(teaser).not.toHaveProperty("userId");
    expect(teaser).not.toHaveProperty("photoUrl");
    expect(teaser).not.toHaveProperty("photos");
    expect(teaser).not.toHaveProperty("bio");
    expect(teaser).not.toHaveProperty("lineId");
    expect(teaser).not.toHaveProperty("phoneNumber");
    expect(teaser).not.toHaveProperty("whatsappNumber");
  });

  it("locked Top Talent teaser keeps first name, place, role, and pay", () => {
    const locked = toRecruiterWorkerTeaserDto(profileWithSecrets(), true);
    expect(locked).toEqual({
      mode: "teaser",
      id: "profile-1",
      firstName: "Somchai",
      location: "Bangkok",
      area: "Sukhumvit",
      jobRoles: ["Server"],
      availability: ["Full-time"],
      expectedPayMin: 15000,
      expectedPayPeriod: "month",
      payCurrency: "THB",
      isTopTalent: true,
      isVerified: true,
      teaserPhotoPath: "/api/workers/profile-1/teaser-photo",
    });
    expect(JSON.stringify(locked)).not.toContain(SECRET_LINE);
    expect(JSON.stringify(locked)).not.toContain(SECRET_PHONE);
  });

  it("unverified access maps regular workers to teaser and TT to locked", () => {
    const unverified = {
      canBrowseFull: false,
      canViewTopTalentFull: false,
    };
    const regular = toRecruiterSearchWorkerDto(
      profileWithSecrets(),
      unverified,
      false
    );
    const topTalent = toRecruiterSearchWorkerDto(
      profileWithSecrets(),
      unverified,
      true
    );

    expect(regular.mode).toBe("teaser");
    if (regular.mode === "teaser") {
      expect(regular.firstName).toBe("Somchai");
    }
    expect(topTalent.mode).toBe("teaser");
    if (topTalent.mode === "teaser") {
      expect(topTalent.firstName).toBe("Somchai");
      expect(topTalent.area).toBe("Sukhumvit");
      expect(topTalent.jobRoles).toEqual(["Server"]);
      expect(topTalent.expectedPayMin).toBe(15000);
      expect(topTalent).not.toHaveProperty("lineId");
      expect(topTalent).not.toHaveProperty("phoneNumber");
    }
  });

  it("full DTOs still omit contact fields", () => {
    const detail = toWorkerProfileDetail(profileWithSecrets(), {
      isTopTalent: false,
      photos: [],
      hasExpressedInterest: false,
    });
    const search = toSearchWorkerResult(profileWithSecrets(), false);
    expect(detail.mode).toBe("full");
    expect(search.mode).toBe("full");
    expect(JSON.stringify(detail)).not.toContain(SECRET_LINE);
    expect(JSON.stringify(search)).not.toContain(SECRET_USER_ID);
  });
});
