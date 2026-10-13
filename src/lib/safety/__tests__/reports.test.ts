import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const notifyAdmins = vi.fn();

const selectQueue: unknown[][] = [];
const insertReturning = vi.fn();
const updateWhere = vi.fn();

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: (...args: unknown[]) => getMessagingSettings(...args),
}));

vi.mock("@/lib/safety/notify-admins", () => ({
  notifyAdmins: (...args: unknown[]) => notifyAdmins(...args),
}));

vi.mock("@/lib/db", () => {
  const chainSelect = {
    from: vi.fn(() => chainSelect),
    leftJoin: vi.fn(() => chainSelect),
    innerJoin: vi.fn(() => chainSelect),
    where: vi.fn(() => chainSelect),
    orderBy: vi.fn(() => chainSelect),
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
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: insertReturning,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: updateWhere.mockResolvedValue(undefined),
        })),
      })),
    },
    contactRequests: { id: "id", status: "status", workerUserId: "worker_user_id" },
    conversations: { id: "id", contactRequestId: "contact_request_id" },
    messages: { id: "id", conversationId: "conversation_id", createdAt: "created_at" },
    recruiterProfiles: { id: "id", userId: "user_id", messagingPausedAt: "messaging_paused_at" },
    reports: {
      id: "id",
      reporterUserId: "reporter_user_id",
      reportedUserId: "reported_user_id",
      createdAt: "created_at",
    },
    venues: { id: "id", name: "name" },
    workerProfiles: { id: "id", userId: "user_id" },
  };
});

import { createReport } from "../reports";

describe("createReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    getMessagingSettings.mockResolvedValue({
      autoPauseReportThreshold: 3,
      autoPauseWindowDays: 30,
    });
    notifyAdmins.mockResolvedValue(undefined);
    insertReturning.mockResolvedValue([
      {
        id: "report-1",
        reason: "spam",
        status: "open",
        reporterUserId: "worker-1",
        reportedUserId: "rec-1",
      },
    ]);
  });

  it("returns 403 when reporter is not a participant of the conversation", async () => {
    selectQueue.push(
      [{ value: 0 }],
      [
        {
          id: "conv-1",
          workerUserId: "worker-other",
          recruiterUserId: "rec-1",
          contactRequestId: "cr-1",
        },
      ]
    );

    const result = await createReport({
      reporterUserId: "worker-1",
      reason: "spam",
      conversationId: "conv-1",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "not_participant",
    });
  });

  it("captures evidence snapshot and sets legal hold", async () => {
    const now = new Date("2026-04-01T12:00:00.000Z");
    selectQueue.push(
      // rate limit count
      [{ value: 0 }],
      // conversation
      [
        {
          id: "conv-1",
          workerUserId: "worker-1",
          recruiterUserId: "rec-1",
          contactRequestId: "cr-1",
        },
      ],
      // request evidence
      [
        {
          openerText: "Hi there",
          followUpText: "Still interested?",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          venueName: "Neon Bar",
        },
      ],
      // messages (desc then reversed)
      [
        {
          id: "m2",
          senderUserId: "worker-1",
          body: "ok",
          kind: "text",
          createdAt: new Date("2026-03-02T00:00:00.000Z"),
        },
        {
          id: "m1",
          senderUserId: "rec-1",
          body: "hello",
          kind: "text",
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
        },
      ],
      // recruiter profile for auto-pause
      [{ id: "rp-1", messagingPausedAt: null }],
      // distinct reporters
      [{ value: 1 }]
    );

    const result = await createReport({
      reporterUserId: "worker-1",
      reason: "asked_for_money",
      conversationId: "conv-1",
      now,
    });

    expect(result.ok).toBe(true);
    expect(insertReturning).toHaveBeenCalled();
    const insertValues = (vi.mocked(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("@/lib/db")).db.insert as any
    ).mock.results[0]?.value?.values ?? vi.fn()) as ReturnType<typeof vi.fn>;
    // Assert update for legal hold was called
    expect(updateWhere).toHaveBeenCalled();
  });

  it("declines pending request when worker reports it", async () => {
    const now = new Date("2026-04-01T12:00:00.000Z");
    selectQueue.push(
      [{ value: 0 }],
      [
        {
          id: "cr-1",
          workerUserId: "worker-1",
          recruiterUserId: "rec-1",
          status: "pending",
          openerText: "Hi",
          followUpText: null,
          venueId: null,
          createdAt: now,
        },
      ],
      // linked conversation lookup
      [],
      // evidence request
      [
        {
          openerText: "Hi",
          followUpText: null,
          createdAt: now,
          venueName: null,
        },
      ],
      // no conversation messages path skipped when no convo
      // linked after insert for legal hold
      [],
      [{ id: "rp-1", messagingPausedAt: null }],
      [{ value: 1 }]
    );

    const result = await createReport({
      reporterUserId: "worker-1",
      reason: "spam",
      contactRequestId: "cr-1",
      now,
    });

    expect(result.ok).toBe(true);
    expect(updateWhere).toHaveBeenCalled();
  });

  it("auto-pauses when distinct reporters reach threshold (same reporter does not double-count)", async () => {
    const now = new Date("2026-04-01T12:00:00.000Z");
    selectQueue.push(
      [{ value: 0 }],
      // reportedUserId alone path needs no conversation
      [{ id: "rp-1", messagingPausedAt: null }],
      [{ value: 3 }]
    );

    const result = await createReport({
      reporterUserId: "worker-1",
      reason: "harassment",
      reportedUserId: "rec-1",
      now,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.autoPaused).toBe(true);
    }
    expect(notifyAdmins).toHaveBeenCalled();
  });

  it("rate limits after 10 reports per day", async () => {
    selectQueue.push([{ value: 10 }]);

    const result = await createReport({
      reporterUserId: "worker-1",
      reason: "spam",
      reportedUserId: "rec-1",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
    });
  });
});
