import { describe, expect, it } from "vitest";
import {
  isBlockedAttemptFlagDueForDeletion,
  isContactRequestDueForDeletion,
  isConversationDueForDeletion,
  isNotificationDueForDeletion,
  isReportSnapshotDueForClear,
  runMessagingRetention,
  type ContactRequestRetentionRow,
  type ConversationRetentionRow,
  type FlagRetentionRow,
  type MessagingRetentionStore,
  type NotificationRetentionRow,
  type ReportSnapshotRetentionRow,
} from "../messaging-retention";

const NOW = new Date("2026-10-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function conversation(
  id: string,
  overrides: Partial<ConversationRetentionRow> = {}
): ConversationRetentionRow {
  return {
    id,
    retentionExpiresAt: new Date(NOW.getTime() - DAY),
    legalHoldUntil: null,
    workerHiddenAt: null,
    recruiterHiddenAt: null,
    ...overrides,
  };
}

function createMemoryStore(input: {
  conversations: ConversationRetentionRow[];
  contactRequests?: ContactRequestRetentionRow[];
  notifications?: NotificationRetentionRow[];
  flags?: FlagRetentionRow[];
  reports?: ReportSnapshotRetentionRow[];
  retentionDays?: number;
}): MessagingRetentionStore & {
  conversations: ConversationRetentionRow[];
  contactRequests: ContactRequestRetentionRow[];
  notifications: NotificationRetentionRow[];
  flags: FlagRetentionRow[];
  reports: ReportSnapshotRetentionRow[];
} {
  const state = {
    conversations: [...input.conversations],
    contactRequests: [...(input.contactRequests ?? [])],
    notifications: [...(input.notifications ?? [])],
    flags: [...(input.flags ?? [])],
    reports: [...(input.reports ?? [])],
  };

  function page<T extends { id: string }>(
    rows: T[],
    limit: number,
    afterId: string | null
  ): T[] {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const start = afterId
      ? sorted.findIndex((row) => row.id === afterId) + 1
      : 0;
    return sorted.slice(start, start + limit);
  }

  return {
    get conversations() {
      return state.conversations;
    },
    get contactRequests() {
      return state.contactRequests;
    },
    get notifications() {
      return state.notifications;
    },
    get flags() {
      return state.flags;
    },
    get reports() {
      return state.reports;
    },
    retentionDays: async () => input.retentionDays ?? 180,
    listConversations: async (_now, limit, afterId) =>
      page(state.conversations, limit, afterId),
    deleteConversations: async (ids) => {
      state.conversations = state.conversations.filter(
        (row) => !ids.includes(row.id)
      );
    },
    listContactRequests: async (_now, limit, afterId) =>
      page(state.contactRequests, limit, afterId),
    deleteContactRequests: async (ids) => {
      state.contactRequests = state.contactRequests.filter(
        (row) => !ids.includes(row.id)
      );
    },
    listNotifications: async (limit, afterId) =>
      page(state.notifications, limit, afterId),
    deleteNotifications: async (ids) => {
      state.notifications = state.notifications.filter(
        (row) => !ids.includes(row.id)
      );
    },
    listFlags: async (limit, afterId) => page(state.flags, limit, afterId),
    deleteFlags: async (ids) => {
      state.flags = state.flags.filter((row) => !ids.includes(row.id));
    },
    listReports: async (limit, afterId) => page(state.reports, limit, afterId),
    clearReportSnapshots: async (ids) => {
      state.reports = state.reports.map((row) =>
        ids.includes(row.id) ? { ...row, hasEvidenceSnapshot: false } : row
      );
    },
  };
}

describe("runMessagingRetention", () => {
  it("deletes expired conversations without a legal hold and keeps holds and hidden unexpired chats", async () => {
    const store = createMemoryStore({
      conversations: [
        conversation("expired-open"),
        conversation("held", {
          legalHoldUntil: new Date(NOW.getTime() + 30 * DAY),
        }),
        conversation("hidden-fresh", {
          retentionExpiresAt: new Date(NOW.getTime() + 10 * DAY),
          workerHiddenAt: new Date(NOW.getTime() - DAY),
        }),
        conversation("hold-expired", {
          legalHoldUntil: new Date(NOW.getTime() - DAY),
        }),
      ],
    });

    const counts = await runMessagingRetention(NOW, { batchSize: 10, store });

    expect(counts.conversationsDeleted).toBe(2);
    expect(store.conversations.map((row) => row.id).sort()).toEqual([
      "held",
      "hidden-fresh",
    ]);
    expect(isConversationDueForDeletion(store.conversations[0]!, NOW)).toBe(
      false
    );
  });

  it("deletes aged closed requests with no conversation and no active legal-hold report", async () => {
    const old = new Date(NOW.getTime() - 200 * DAY);
    const recent = new Date(NOW.getTime() - DAY);
    const base = {
      respondedAt: old,
      expiresAt: null,
      updatedAt: old,
      hasConversation: false,
      hasActiveLegalHoldReport: false,
    };
    const store = createMemoryStore({
      conversations: [],
      contactRequests: [
        { id: "old-declined", status: "declined", ...base },
        { id: "old-withdrawn", status: "withdrawn", ...base },
        { id: "old-expired", status: "expired", ...base },
        {
          id: "recent-declined",
          status: "declined",
          ...base,
          respondedAt: recent,
          updatedAt: recent,
        },
        {
          id: "has-chat",
          status: "declined",
          ...base,
          hasConversation: true,
        },
        {
          id: "held-report",
          status: "expired",
          ...base,
          hasActiveLegalHoldReport: true,
        },
        { id: "still-pending", status: "pending", ...base },
      ],
    });

    const counts = await runMessagingRetention(NOW, { store });
    expect(counts.contactRequestsDeleted).toBe(3);
    expect(store.contactRequests.map((row) => row.id).sort()).toEqual([
      "has-chat",
      "held-report",
      "recent-declined",
      "still-pending",
    ]);
    expect(
      isContactRequestDueForDeletion(store.contactRequests[0]!, NOW, 180)
    ).toBe(false);
  });

  it("deletes notifications older than 90 days, closed blocked-attempt flags, and stale report snapshots", async () => {
    const store = createMemoryStore({
      conversations: [],
      notifications: [
        { id: "old-note", createdAt: new Date(NOW.getTime() - 91 * DAY) },
        { id: "new-note", createdAt: new Date(NOW.getTime() - 10 * DAY) },
      ],
      flags: [
        {
          id: "old-closed",
          targetType: "blocked_attempt",
          status: "dismissed",
          createdAt: new Date(NOW.getTime() - 200 * DAY),
        },
        {
          id: "old-open",
          targetType: "blocked_attempt",
          status: "open",
          createdAt: new Date(NOW.getTime() - 200 * DAY),
        },
        {
          id: "message-flag",
          targetType: "message",
          status: "dismissed",
          createdAt: new Date(NOW.getTime() - 200 * DAY),
        },
      ],
      reports: [
        {
          id: "old-resolved",
          resolvedAt: new Date(NOW.getTime() - 800 * DAY),
          hasEvidenceSnapshot: true,
        },
        {
          id: "recent-resolved",
          resolvedAt: new Date(NOW.getTime() - 10 * DAY),
          hasEvidenceSnapshot: true,
        },
      ],
    });

    const counts = await runMessagingRetention(NOW, { store });
    expect(counts.notificationsDeleted).toBe(1);
    expect(counts.messageFlagsDeleted).toBe(1);
    expect(counts.reportSnapshotsCleared).toBe(1);
    expect(store.notifications.map((row) => row.id)).toEqual(["new-note"]);
    expect(store.flags.map((row) => row.id).sort()).toEqual([
      "message-flag",
      "old-open",
    ]);
    expect(
      store.reports.find((row) => row.id === "old-resolved")?.hasEvidenceSnapshot
    ).toBe(false);
    expect(
      store.reports.find((row) => row.id === "recent-resolved")
        ?.hasEvidenceSnapshot
    ).toBe(true);
    expect(
      isNotificationDueForDeletion(
        { id: "new-note", createdAt: new Date(NOW.getTime() - 10 * DAY) },
        NOW
      )
    ).toBe(false);
    expect(
      isBlockedAttemptFlagDueForDeletion(
        {
          id: "old-open",
          targetType: "blocked_attempt",
          status: "open",
          createdAt: new Date(NOW.getTime() - 200 * DAY),
        },
        NOW,
        180
      )
    ).toBe(false);
    expect(
      isReportSnapshotDueForClear(
        {
          id: "recent-resolved",
          resolvedAt: new Date(NOW.getTime() - 10 * DAY),
          hasEvidenceSnapshot: true,
        },
        NOW
      )
    ).toBe(false);
  });

  it("pages through batches and a second run is a no-op", async () => {
    const store = createMemoryStore({
      conversations: ["a", "b", "c", "d", "e"].map((id) => conversation(id)),
    });

    const first = await runMessagingRetention(NOW, { batchSize: 2, store });
    expect(first.conversationsDeleted).toBe(5);
    expect(store.conversations).toHaveLength(0);

    const second = await runMessagingRetention(NOW, { batchSize: 2, store });
    expect(second).toEqual({
      conversationsDeleted: 0,
      contactRequestsDeleted: 0,
      notificationsDeleted: 0,
      messageFlagsDeleted: 0,
      reportSnapshotsCleared: 0,
    });
  });
});
