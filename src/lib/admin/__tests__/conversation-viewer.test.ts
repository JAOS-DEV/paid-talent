import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAdminAuditEvent = vi.fn();
const selectQueue: unknown[][] = [];
const callOrder: string[] = [];

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAuditEvent: (...args: unknown[]) => {
    callOrder.push("audit");
    return recordAdminAuditEvent(...args);
  },
}));

vi.mock("@/lib/db", () => {
  const chainSelect = {
    from: vi.fn(() => chainSelect),
    leftJoin: vi.fn(() => chainSelect),
    where: vi.fn(() => chainSelect),
    orderBy: vi.fn(() => {
      callOrder.push("data");
      return chainSelect;
    }),
    limit: vi.fn(async () => selectQueue.shift() ?? []),
    then(
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void
    ): void {
      void Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject);
    },
  };

  return {
    db: {
      select: vi.fn(() => chainSelect),
    },
    conversations: { id: "id" },
    contactRequests: { id: "id" },
    contactShares: { id: "id" },
    messageFlags: { id: "id", status: "status", authorUserId: "author_user_id" },
    messages: { id: "id", conversationId: "conversation_id", createdAt: "created_at" },
    reports: {
      id: "id",
      conversationId: "conversation_id",
      status: "status",
      reportedUserId: "reported_user_id",
      reporterUserId: "reporter_user_id",
    },
    users: { id: "id", name: "name" },
    venues: { id: "id", name: "name" },
  };
});

import { getAdminConversationView } from "../conversation-viewer";

describe("getAdminConversationView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    callOrder.length = 0;
    recordAdminAuditEvent.mockResolvedValue(undefined);
  });

  it("returns 400 without a reason of at least 5 chars", async () => {
    const result = await getAdminConversationView({
      conversationId: "conv-1",
      reason: "hi",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      reason: "reason_required",
    });
    expect(recordAdminAuditEvent).not.toHaveBeenCalled();
  });

  it("returns 403 when conversation is not reported or flagged", async () => {
    selectQueue.push(
      [
        {
          id: "conv-1",
          contactRequestId: "cr-1",
          workerUserId: "w1",
          recruiterUserId: "r1",
          status: "open",
          createdAt: new Date(),
          legalHoldUntil: null,
        },
      ],
      [],
      [],
      [],
      []
    );

    const result = await getAdminConversationView({
      conversationId: "conv-1",
      reason: "investigating scam report",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      reason: "not_reported_or_flagged",
    });
    expect(recordAdminAuditEvent).not.toHaveBeenCalled();
  });

  it("writes audit before returning data", async () => {
    selectQueue.push(
      [
        {
          id: "conv-1",
          contactRequestId: "cr-1",
          workerUserId: "w1",
          recruiterUserId: "r1",
          status: "open",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          legalHoldUntil: null,
        },
      ],
      [{ id: "report-1" }],
      [],
      [],
      [],
      [
        {
          id: "cr-1",
          openerText: "hi",
          followUpText: null,
          status: "accepted",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          venueName: "Bar",
        },
      ],
      [],
      [],
      [{ id: "w1", name: "Worker" }],
      [{ id: "r1", name: "Recruiter" }]
    );

    const result = await getAdminConversationView({
      conversationId: "conv-1",
      reason: "reviewing open report",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result.ok).toBe(true);
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "conversation_viewed",
        targetType: "conversation",
        targetId: "conv-1",
        metadata: expect.objectContaining({
          reportIds: ["report-1"],
        }),
      })
    );
    // messages query uses orderBy — that is the first "data" marker after audit
    expect(callOrder.indexOf("audit")).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf("data")).toBeGreaterThan(callOrder.indexOf("audit"));
  });
});
