import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAdminAuditEvent = vi.fn();
const selectLimit = vi.fn();
const updateWhere = vi.fn();

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAuditEvent: (...args: unknown[]) => recordAdminAuditEvent(...args),
}));

vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateWhere.mockResolvedValue(undefined),
      })),
    })),
  },
  reports: { id: "id" },
  messageFlags: { id: "id" },
  conversations: { id: "id" },
  users: { id: "id" },
}));

import { resolveReport, reviewMessageFlag } from "../reports";
import { setRecruiterMessagingPaused } from "@/lib/safety/messaging-pause";

vi.mock("@/lib/safety/messaging-pause", async () => {
  const actual = await vi.importActual<typeof import("@/lib/safety/messaging-pause")>(
    "@/lib/safety/messaging-pause"
  );
  return actual;
});

describe("admin report/flag resolve auditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordAdminAuditEvent.mockResolvedValue(undefined);
  });

  it("resolveReport writes report_resolved audit", async () => {
    selectLimit.mockResolvedValue([
      {
        id: "rep-1",
        status: "open",
        reportedUserId: "u1",
        reason: "spam",
        resolvedBy: null,
        resolvedAt: null,
      },
    ]);

    const result = await resolveReport({
      reportId: "rep-1",
      status: "dismissed",
      note: "Not actionable",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result.ok).toBe(true);
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "report_resolved",
        targetId: "rep-1",
      })
    );
  });

  it("reviewMessageFlag writes message_flag_reviewed audit", async () => {
    selectLimit.mockResolvedValue([
      {
        id: "flag-1",
        status: "open",
        authorUserId: "u1",
        categories: ["deposit"],
      },
    ]);

    const result = await reviewMessageFlag({
      flagId: "flag-1",
      status: "actioned",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result.ok).toBe(true);
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "message_flag_reviewed",
        targetId: "flag-1",
      })
    );
  });
});

describe("setRecruiterMessagingPaused", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordAdminAuditEvent.mockResolvedValue(undefined);
  });

  it("audits pause and unpause", async () => {
    // Re-mock db for messaging-pause module path
    const { db } = await import("@/lib/db");
    const limit = vi.fn();
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit,
        })),
      })),
    } as never);
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    } as never);

    limit.mockResolvedValue([
      { id: "rp-1", messagingPausedAt: null },
    ]);

    const paused = await setRecruiterMessagingPaused({
      recruiterUserId: "rec-1",
      paused: true,
      reason: "Multiple reports",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(paused.ok).toBe(true);
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recruiter_messaging_paused" })
    );

    limit.mockResolvedValue([
      { id: "rp-1", messagingPausedAt: new Date() },
    ]);
    const unpaused = await setRecruiterMessagingPaused({
      recruiterUserId: "rec-1",
      paused: false,
      reason: "Cleared after review",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(unpaused.ok).toBe(true);
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recruiter_messaging_unpaused" })
    );
  });
});
