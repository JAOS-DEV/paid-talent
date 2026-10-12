import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerificationSubjectAdapter, VerificationSubjectRecord } from "../subject";

const assertOwnedPrivateVerificationKey = vi.fn();
const getOwnedIdDocumentBuffer = vi.fn();
const getOwnedLivenessVideoBuffer = vi.fn();
const generatePresignedIdUploadUrl = vi.fn();
const generatePresignedLivenessVideoUploadUrl = vi.fn();
const insertValues = vi.fn();

vi.mock("@/lib/storage/keys", () => ({
  assertOwnedPrivateVerificationKey: (...args: unknown[]) =>
    assertOwnedPrivateVerificationKey(...args),
}));

vi.mock("@/lib/storage/s3", () => ({
  ALLOWED_ID_DOCUMENT_TYPES: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  ALLOWED_LIVENESS_VIDEO_TYPES: ["video/mp4", "video/webm", "video/quicktime"],
  getOwnedIdDocumentBuffer: (...args: unknown[]) =>
    getOwnedIdDocumentBuffer(...args),
  getOwnedLivenessVideoBuffer: (...args: unknown[]) =>
    getOwnedLivenessVideoBuffer(...args),
  generatePresignedIdUploadUrl: (...args: unknown[]) =>
    generatePresignedIdUploadUrl(...args),
  generatePresignedLivenessVideoUploadUrl: (...args: unknown[]) =>
    generatePresignedLivenessVideoUploadUrl(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: insertValues })),
  },
  verificationEvents: {},
}));

import { submitVerification } from "../service";

function baseProfile(
  overrides: Partial<VerificationSubjectRecord> = {}
): VerificationSubjectRecord {
  return {
    id: "recruiter-profile-1",
    userId: "user-1",
    verificationStatus: "unverified",
    isVerified: false,
    idDocumentKey: "verification-docs/user-1/id.jpg",
    livenessVideoKey: null,
    challengeCode: "123456",
    challengeIssuedAt: new Date(),
    idDocumentSubmittedAt: null,
    verificationReviewedAt: null,
    verificationReviewedBy: null,
    verifiedAt: null,
    displayName: "Venue",
    organizationName: "Venue",
    ...overrides,
  };
}

function makeSubject(
  profile: VerificationSubjectRecord | null
): VerificationSubjectAdapter {
  return {
    type: "recruiter",
    actorType: "recruiter",
    profileNotFoundError: "Recruiter profile not found",
    loadByUserId: vi.fn(async () => profile),
    loadById: vi.fn(async () => profile),
    update: vi.fn(async (_id, patch) => ({
      ...(profile as VerificationSubjectRecord),
      ...patch,
      verificationStatus:
        (patch.verificationStatus as VerificationSubjectRecord["verificationStatus"]) ??
        profile!.verificationStatus,
    })),
    eventFk: (id) => ({ recruiterProfileId: id }),
    ensureByUserId: vi.fn(async () => profile as VerificationSubjectRecord),
  };
}

describe("verification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertOwnedPrivateVerificationKey.mockImplementation(() => undefined);
    getOwnedIdDocumentBuffer.mockResolvedValue(Buffer.from("id"));
    getOwnedLivenessVideoBuffer.mockResolvedValue(Buffer.from("video"));
    insertValues.mockResolvedValue(undefined);
  });

  it("rejects keys owned by another user", async () => {
    assertOwnedPrivateVerificationKey.mockImplementation(() => {
      throw new Error("not owned");
    });
    const subject = makeSubject(baseProfile());

    const response = await submitVerification(subject, "user-1", {
      idDocumentKey: "verification-docs/other-user/id.jpg",
      livenessVideoKey: "verification-liveness/other-user/live.webm",
      docType: "passport",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid verification upload");
  });

  it("rejects submit without a challenge", async () => {
    const subject = makeSubject(
      baseProfile({ challengeCode: null, challengeIssuedAt: null })
    );

    const response = await submitVerification(subject, "user-1", {
      idDocumentKey: "verification-docs/user-1/id.jpg",
      livenessVideoKey: "verification-liveness/user-1/live.webm",
      docType: "passport",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Verification submission incomplete");
    expect(body.details).toEqual(
      expect.arrayContaining(["Challenge code is required"])
    );
  });

  it("enforces transition rules before pending", async () => {
    const subject = makeSubject(
      baseProfile({ verificationStatus: "pending" })
    );

    const response = await submitVerification(subject, "user-1", {
      idDocumentKey: "verification-docs/user-1/id.jpg",
      livenessVideoKey: "verification-liveness/user-1/live.webm",
      docType: "passport",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Cannot submit verification");
    expect(body.currentStatus).toBe("pending");
  });

  it("submits a valid recruiter verification", async () => {
    const subject = makeSubject(baseProfile());

    const response = await submitVerification(subject, "user-1", {
      idDocumentKey: "verification-docs/user-1/id.jpg",
      livenessVideoKey: "verification-liveness/user-1/live.webm",
      docType: "passport",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.verification.verificationStatus).toBe("pending");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recruiterProfileId: "recruiter-profile-1",
        actorType: "recruiter",
        decision: "pending_submitted",
      })
    );
  });
});
