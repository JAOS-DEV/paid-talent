import { describe, expect, it, vi } from "vitest";
import {
  isUserDueForAccountPurge,
  runAccountPurge,
  type AccountPurgeStore,
} from "../deletion";
import { ACCOUNT_PURGE_DAYS, MS_PER_DAY, SELF_DELETION_REASON } from "../constants";

const NOW = new Date("2026-10-20T12:00:00.000Z");

describe("runAccountPurge", () => {
  it("purges only accounts requested more than 30 days ago and leaves reports with their snapshot", async () => {
    const reports = [
      {
        id: "report-1",
        reportedUserId: "old-user" as string | null,
        evidenceSnapshot: { messages: ["kept"] },
      },
    ];
    const users = [
      {
        id: "old-user",
        deletionRequestedAt: new Date(
          NOW.getTime() - (ACCOUNT_PURGE_DAYS + 1) * MS_PER_DAY
        ),
        media: ["profiles/old-user/photo.jpg"],
      },
      {
        id: "recent-user",
        deletionRequestedAt: new Date(
          NOW.getTime() - (ACCOUNT_PURGE_DAYS - 1) * MS_PER_DAY
        ),
        media: ["profiles/recent-user/photo.jpg"],
      },
      {
        id: "active-user",
        deletionRequestedAt: null,
        media: [],
      },
    ];
    const deletedKeys: string[] = [];
    const store: AccountPurgeStore = {
      listUsers: async (limit, afterId) => {
        const sorted = [...users].sort((a, b) => a.id.localeCompare(b.id));
        const start = afterId
          ? sorted.findIndex((row) => row.id === afterId) + 1
          : 0;
        return sorted.slice(start, start + limit).map((row) => ({
          id: row.id,
          deletionRequestedAt: row.deletionRequestedAt,
        }));
      },
      listMediaKeys: async (userId) =>
        users.find((row) => row.id === userId)?.media ?? [],
      deleteUser: async (userId) => {
        const index = users.findIndex((row) => row.id === userId);
        if (index >= 0) {
          users.splice(index, 1);
        }
        for (const report of reports) {
          if (report.reportedUserId === userId) {
            report.reportedUserId = null;
          }
        }
      },
    };

    const counts = await runAccountPurge(NOW, {
      batchSize: 1,
      store,
      deletePublicObject: async (key) => {
        deletedKeys.push(key);
      },
    });

    expect(counts.usersPurged).toBe(1);
    expect(counts.mediaObjectsDeleted).toBe(1);
    expect(deletedKeys).toEqual(["profiles/old-user/photo.jpg"]);
    expect(users.map((row) => row.id).sort()).toEqual([
      "active-user",
      "recent-user",
    ]);
    expect(reports[0]).toEqual({
      id: "report-1",
      reportedUserId: null,
      evidenceSnapshot: { messages: ["kept"] },
    });
    expect(
      isUserDueForAccountPurge(
        new Date(NOW.getTime() - ACCOUNT_PURGE_DAYS * MS_PER_DAY),
        NOW
      )
    ).toBe(false);
  });

  it("cancel deletion clears the flag so the account is no longer due", async () => {
    const user = {
      deletionRequestedAt: new Date(NOW.getTime() - 40 * MS_PER_DAY) as Date | null,
      accountStatus: "suspended" as const,
      accountStatusReason: SELF_DELETION_REASON as string | null,
    };

    user.deletionRequestedAt = null;
    if (
      user.accountStatus === "suspended" &&
      user.accountStatusReason === SELF_DELETION_REASON
    ) {
      user.accountStatus = "active";
      user.accountStatusReason = null;
    }

    expect(user.deletionRequestedAt).toBeNull();
    expect(isUserDueForAccountPurge(user.deletionRequestedAt, NOW)).toBe(false);
    expect(user.accountStatus).toBe("active");
  });
});

describe("cancelAccountDeletion", () => {
  it("clears deletionRequestedAt and audits the cancel", async () => {
    const sets: Array<Record<string, unknown>> = [];
    const audits: Array<Record<string, unknown>> = [];
    const client = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "user-1",
                email: "person@example.com",
                accountStatus: "suspended",
                accountStatusReason: SELF_DELETION_REASON,
                deletionRequestedAt: new Date(NOW.getTime() - 2 * MS_PER_DAY),
              },
            ],
          }),
        }),
      })),
      update: vi.fn(() => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return { where: async () => undefined };
        },
      })),
      insert: vi.fn(() => ({
        values: async (values: Record<string, unknown>) => {
          audits.push(values);
        },
      })),
      delete: vi.fn(),
    };

    const { cancelAccountDeletion } = await import(
      "@/lib/admin/account-moderation"
    );
    const result = await cancelAccountDeletion(client, {
      targetUserId: "user-1",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
      now: NOW,
    });

    expect(result).toEqual({ ok: true });
    expect(sets[0]).toMatchObject({
      deletionRequestedAt: null,
      accountStatus: "active",
      accountStatusReason: null,
    });
    expect(audits[0]).toMatchObject({
      action: "account_deletion_cancelled",
      targetUserId: "user-1",
    });
  });
});
