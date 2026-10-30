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
    runMessagingMaintenance.mockResolvedValue({
      expired: 1,
      released: 0,
      workersProcessed: 0,
    });
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
    expect(runMessagingMaintenance).not.toHaveBeenCalled();
    expect(retryPending).not.toHaveBeenCalled();
    expect(runMessagingRetention).not.toHaveBeenCalled();
    expect(runAccountPurge).not.toHaveBeenCalled();
    expect(runVerificationMediaRetentionJob).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong bearer secret", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/messaging-maintenance", {
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    expect(response.status).toBe(401);
    expect(runMessagingMaintenance).not.toHaveBeenCalled();
    expect(retryPending).not.toHaveBeenCalled();
  });

  it("runs every maintenance step and returns counts", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/messaging-maintenance", {
        headers: { authorization: "Bearer cron-test-secret" },
      })
    );
    expect(response.status).toBe(200);
    expect(runMessagingMaintenance).toHaveBeenCalledOnce();
    expect(retryPending).toHaveBeenCalledOnce();
    expect(runMessagingRetention).toHaveBeenCalledOnce();
    expect(runVerificationMediaRetentionJob).toHaveBeenCalledOnce();
    expect(runAccountPurge).toHaveBeenCalledOnce();
    expect(
      runVerificationMediaRetentionJob.mock.invocationCallOrder[0]
    ).toBeLessThan(runAccountPurge.mock.invocationCallOrder[0]!);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.failed).toEqual([]);
    expect(body.messagingMaintenance).toEqual({
      expired: 1,
      released: 0,
      workersProcessed: 0,
    });
    expect(body.notificationsRetried).toBe(2);
    expect(body.retention.conversationsDeleted).toBe(3);
    expect(body.accountPurge.usersPurged).toBe(0);
    expect(body.verificationMedia.idDocumentsDeleted).toBe(1);
  });

  it("keeps going when one step fails", async () => {
    retryPending.mockRejectedValue(new Error("date param"));
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/messaging-maintenance", {
        headers: { authorization: "Bearer cron-test-secret" },
      })
    );
    expect(response.status).toBe(200);
    expect(runMessagingMaintenance).toHaveBeenCalledOnce();
    expect(runMessagingRetention).toHaveBeenCalledOnce();
    expect(runVerificationMediaRetentionJob).toHaveBeenCalledOnce();
    expect(runAccountPurge).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.notificationsRetried).toBeNull();
    expect(body.retention.conversationsDeleted).toBe(3);
    expect(body.failed).toEqual([
      { step: "notifications", error: "date param" },
    ]);
  });

  it("returns 500 only when every step fails", async () => {
    const failure = new Error("down");
    runMessagingMaintenance.mockRejectedValue(failure);
    retryPending.mockRejectedValue(failure);
    runMessagingRetention.mockRejectedValue(failure);
    runVerificationMediaRetentionJob.mockRejectedValue(failure);
    runAccountPurge.mockRejectedValue(failure);
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/messaging-maintenance", {
        headers: { authorization: "Bearer cron-test-secret" },
      })
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.failed).toHaveLength(5);
    expect(body.failed.map((item: { step: string }) => item.step)).toEqual([
      "messagingMaintenance",
      "notifications",
      "retention",
      "verificationMedia",
      "accountPurge",
    ]);
  });
});
