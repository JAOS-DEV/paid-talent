import { describe, expect, it } from "vitest";
import type { WorkerProfile } from "@/lib/db/schema";
import {
  toSearchWorkerResult,
  toWorkerProfileDetail,
} from "../recruiter-dto";

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
    displayName: "Test Worker",
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

function assertNoContactLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(SECRET_LINE);
  expect(json).not.toContain(SECRET_WHATSAPP);
  expect(json).not.toContain(SECRET_PHONE);
  expect(json).not.toContain(SECRET_USER_ID);

  const keys = json.match(/"[^"]+"/g) ?? [];
  for (const key of keys) {
    expect(key).not.toMatch(/line|whatsapp|phone|userId/i);
  }
}

describe("recruiter DTO contact privacy contract", () => {
  it("toWorkerProfileDetail never leaks contact values or userId", () => {
    const result = toWorkerProfileDetail(profileWithSecrets(), {
      isTopTalent: true,
      photos: [
        {
          id: "photo-1",
          photoUrl: "https://cdn.example/a.jpg",
          displayOrder: 0,
          isCurrentApproved: true,
        },
      ],
      hasExpressedInterest: false,
    });

    assertNoContactLeak(result);
    expect(result).not.toHaveProperty("contact");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("lineId");
    expect(result).not.toHaveProperty("whatsappNumber");
    expect(result).not.toHaveProperty("phoneNumber");
  });

  it("toSearchWorkerResult never leaks contact values or userId", () => {
    const result = toSearchWorkerResult(profileWithSecrets(), true);

    assertNoContactLeak(result);
    expect(result).not.toHaveProperty("contact");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("lineId");
    expect(result).not.toHaveProperty("whatsappNumber");
    expect(result).not.toHaveProperty("phoneNumber");
  });

  it("still omits contacts when the worker is not Top Talent", () => {
    const detail = toWorkerProfileDetail(profileWithSecrets(), {
      isTopTalent: false,
      photos: [],
      hasExpressedInterest: false,
    });
    const search = toSearchWorkerResult(profileWithSecrets(), false);

    assertNoContactLeak(detail);
    assertNoContactLeak(search);
  });
});
