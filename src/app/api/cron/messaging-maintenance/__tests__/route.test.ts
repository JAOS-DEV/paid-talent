import { beforeEach, describe, expect, it, vi } from "vitest";

const runMessagingMaintenance = vi.fn();
const retryPending = vi.fn();
const runMessagingRetention = vi.fn();
const runAccountPurge = vi.fn();
const runVerificationMediaRetentionJob = vi.fn();

vi.mock("@/lib/contact-requests", () => ({
  runMessagingMaintenance: (...args: unknown[]) =>
    runMessagingMaintenance(...args),
}));

vi.mock("@/lib/notifications", () => ({
  retryPending: (...args: unknown[]) => retryPending(...args),
}));

vi.mock("@/lib/jobs/messaging-retention", () => ({
  runMessagingRetention: (...args: unknown[]) => runMessagingRetention(...args),
}));

vi.mock("@/lib/account/deletion", () => ({
  runAccountPurge: (...args: unknown[]) => runAccountPurge(...args),
}));

vi.mock("@/lib/jobs/id-document-retention", () => ({
  runVerificationMediaRetentionJob: (...args: unknown[]) =>
    runVerificationMediaRetentionJob(...args),
}));

describe("GET /api/cron/messaging-maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    runMessagingMaintenance.mockResolvedValue({ expiredRequests: 1 });
    retryPending.mockResolvedValue(2);
    runMessagingRetention.mockResolvedValue({ conversationsDeleted: 3 });
    runAccountPurge.mockResolvedValue({ usersPurged: 0 });
    runVerificationMediaRetentionJob.mockResolvedValue({
      processed: 4,
      idDocumentsDeleted: 1,
      livenessVideosDeleted: 1,
      errors: 0,
      skipped: 0,
      errorDetails: [],
    });
  });

  it("returns 401 without the bearer secret", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/messaging-maintenance")
    );
    expect(response.status).toBe(401);
    expect(runMessagingRetention).not.toHaveBeenCalled();
    expect(runAccountPurge).not.toHaveBeenCalled();
    expect(runVerificationMediaRetentionJob).not.toHaveBeenCalled();
  });

  it("runs retention, account purge, and verification media retention", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/messaging-maintenance", {
        headers: { authorization: "Bearer cron-test-secret" },
      })
    );
    expect(response.status).toBe(200);
    expect(runMessagingMaintenance).toHaveBeenCalledOnce();
    expect(runMessagingRetention).toHaveBeenCalledOnce();
    expect(runAccountPurge).toHaveBeenCalledOnce();
    expect(runVerificationMediaRetentionJob).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.retention.conversationsDeleted).toBe(3);
    expect(body.accountPurge.usersPurged).toBe(0);
    expect(body.verificationMedia.idDocumentsDeleted).toBe(1);
  });
});
