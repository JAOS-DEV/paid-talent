import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

const INTERNAL_NOTE = "INTERNAL-ADMIN-NOTE-do-not-leak";

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveWorker: vi.fn(async () => ({
    ok: true,
    user: { userId: "worker-1", role: "worker" },
  })),
  requireActiveRecruiter: vi.fn(async () => ({
    ok: true,
    user: { userId: "recruiter-1", role: "recruiter" },
  })),
  deniedActiveUserResponse: vi.fn(),
}));

import { GET as getWorkerVerification } from "@/app/api/worker/verification/route";
import { GET as getRecruiterVerification } from "@/app/api/recruiter/verification/route";

function query(result: unknown): object {
  const api: Record<string, unknown> = {};
  const next = (): object => api;
  for (const method of ["from", "where", "orderBy", "innerJoin", "leftJoin"]) {
    api[method] = next;
  }
  api.limit = () => Promise.resolve(result);
  api.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return api;
}

function rejectedProfile(userId: string): Record<string, unknown> {
  return {
    id: "profile-1",
    userId,
    verificationStatus: "rejected",
    isVerified: false,
    idDocumentKey: "private/id.jpg",
    livenessVideoKey: "private/live.webm",
    challengeCode: "123456",
    challengeIssuedAt: null,
    idDocumentSubmittedAt: new Date("2026-01-01T00:00:00.000Z"),
    verificationReviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    verificationReviewedBy: "admin@example.com",
    verifiedAt: null,
    displayName: "Talent",
    organizationName: "Venue Co",
    notes: INTERNAL_NOTE,
  };
}

describe("verification status GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not return admin notes on the worker or recruiter verification routes", async () => {
    const select = vi.mocked(db.select);
    select
      .mockImplementationOnce(() => query([rejectedProfile("worker-1")]) as never)
      .mockImplementationOnce(
        () =>
          query([
            {
              notes: INTERNAL_NOTE,
              userReasonCode: "face_mismatch",
            },
          ]) as never
      )
      .mockImplementationOnce(
        () => query([rejectedProfile("recruiter-1")]) as never
      )
      .mockImplementationOnce(
        () =>
          query([
            {
              notes: INTERNAL_NOTE,
              userReasonCode: "document_expired",
            },
          ]) as never
      );

    const workerJson = await (await getWorkerVerification()).json();
    const recruiterJson = await (await getRecruiterVerification()).json();

    expect(workerJson.verification.rejectionReasonCode).toBe("face_mismatch");
    expect(recruiterJson.verification.rejectionReasonCode).toBe(
      "document_expired"
    );

    for (const body of [workerJson, recruiterJson]) {
      expect(JSON.stringify(body)).not.toContain(INTERNAL_NOTE);
      expect(body.verification).not.toHaveProperty("notes");
      expect(body.verification).not.toHaveProperty("rejectionNote");
    }
  });
});
