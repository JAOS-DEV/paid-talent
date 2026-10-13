import { beforeEach, describe, expect, it, vi } from "vitest";

const loadById = vi.fn();
const update = vi.fn();
const eventFk = vi.fn((id: string) => ({ recruiterProfileId: id }));
const insertValues = vi.fn();
const selectLimit = vi.fn();
const recordAdminAuditEvent = vi.fn();
const getIdDocumentBufferForAdmin = vi.fn();
const getLivenessVideoBufferForAdmin = vi.fn();

vi.mock("@/lib/verification/subject", () => ({
  getVerificationSubject: () => ({
    type: "recruiter",
    profileNotFoundError: "Recruiter profile not found",
    loadById,
    update,
    eventFk,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: insertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
  },
  users: { id: "id", email: "email" },
  verificationEvents: {},
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAuditEvent: (...args: unknown[]) =>
    recordAdminAuditEvent(...args),
}));

vi.mock("@/lib/storage/s3", () => ({
  getIdDocumentBufferForAdmin: (...args: unknown[]) =>
    getIdDocumentBufferForAdmin(...args),
  getLivenessVideoBufferForAdmin: (...args: unknown[]) =>
    getLivenessVideoBufferForAdmin(...args),
}));

vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(async () => null),
}));

import { reviewSubject } from "@/lib/admin/verification-review";

describe("reviewSubject recruiter approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimit.mockResolvedValue([{ id: "admin-user-1" }]);
    getIdDocumentBufferForAdmin.mockResolvedValue(Buffer.from("id"));
    getLivenessVideoBufferForAdmin.mockResolvedValue(Buffer.from("video"));
    insertValues.mockResolvedValue(undefined);
    recordAdminAuditEvent.mockResolvedValue(undefined);
  });

  it("writes recruiter_profile_id, sets is_verified + verified_at, and audits approve", async () => {
    loadById.mockResolvedValue({
      id: "recruiter-profile-1",
      userId: "user-1",
      verificationStatus: "pending",
      isVerified: false,
      idDocumentKey: "verification-docs/user-1/id.jpg",
      livenessVideoKey: "verification-liveness/user-1/live.webm",
      challengeCode: "123456",
      challengeIssuedAt: new Date(),
      idDocumentSubmittedAt: new Date(),
      verificationReviewedAt: null,
      verificationReviewedBy: null,
      verifiedAt: null,
      displayName: "Luxury Venues",
      organizationName: "Luxury Venues",
    });
    update.mockImplementation(
      async (_id: string, patch: Record<string, unknown>) => ({
        id: "recruiter-profile-1",
        userId: "user-1",
        displayName: "Luxury Venues",
        organizationName: "Luxury Venues",
        verificationStatus: patch.verificationStatus,
        verificationReviewedAt: patch.verificationReviewedAt,
        verificationReviewedBy: patch.verificationReviewedBy,
        verifiedAt: patch.verifiedAt ?? null,
        isVerified: patch.isVerified,
      })
    );

    const result = await reviewSubject({
      subjectType: "recruiter",
      profileId: "recruiter-profile-1",
      action: "approve",
      docType: "passport",
      notes: "Looks good",
      admin: { userId: "admin-1", email: "admin@example.com" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recruiterProfileId: "recruiter-profile-1",
        decision: "approved",
      })
    );
    expect(update).toHaveBeenCalledWith(
      "recruiter-profile-1",
      expect.objectContaining({
        verificationStatus: "verified",
        isVerified: true,
        verifiedAt: expect.any(Date),
      })
    );
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recruiter_verification_approved",
        targetType: "recruiter_verification",
        targetId: "recruiter-profile-1",
      })
    );
    expect(result.profile.verifiedAt).toBeInstanceOf(Date);
  });
});
