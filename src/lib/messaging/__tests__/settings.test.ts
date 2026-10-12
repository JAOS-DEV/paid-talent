import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  recordAdminAuditEvent,
  selectLimit,
  returning,
  transaction,
} = vi.hoisted(() => {
  const recordAdminAuditEvent = vi.fn();
  const selectLimit = vi.fn();
  const returning = vi.fn();
  const transaction = vi.fn();
  return { recordAdminAuditEvent, selectLimit, returning, transaction };
});

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAuditEvent: (...args: unknown[]) => recordAdminAuditEvent(...args),
}));

vi.mock("@/lib/db", () => {
  const client = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(async () => undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning,
        })),
      })),
    })),
  };

  transaction.mockImplementation(async (fn: (tx: typeof client) => unknown) =>
    fn(client)
  );

  return {
    db: {
      ...client,
      transaction,
    },
  };
});

vi.mock("@/lib/db/schema", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/schema")>(
    "@/lib/db/schema"
  );
  return actual;
});

import {
  DEFAULT_MESSAGING_SETTINGS,
  invalidateMessagingSettingsCache,
  messagingSettingsPatchSchema,
  updateMessagingSettings,
  validateMessagingSettingsMerge,
} from "../settings";

describe("messaging settings zod", () => {
  it("rejects free daily above weekly", () => {
    const parsed = messagingSettingsPatchSchema.safeParse({
      freeDailyNew: 11,
      freeWeeklyNew: 10,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.freeDailyNew).toBeTruthy();
    }
  });

  it("rejects paid daily above weekly", () => {
    const parsed = messagingSettingsPatchSchema.safeParse({
      paidDailyNew: 101,
      paidWeeklyNew: 100,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects paid top talent above paid daily", () => {
    const parsed = messagingSettingsPatchSchema.safeParse({
      paidDailyNew: 10,
      paidDailyTopTalent: 11,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.paidDailyTopTalent).toBeTruthy();
    }
  });

  it("rejects new recruiter cap above paid daily", () => {
    const parsed = messagingSettingsPatchSchema.safeParse({
      paidDailyNew: 5,
      newRecruiterDailyCap: 6,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects retention outside 30..3650", () => {
    expect(
      messagingSettingsPatchSchema.safeParse({ retentionDays: 29 }).success
    ).toBe(false);
    expect(
      messagingSettingsPatchSchema.safeParse({ retentionDays: 3651 }).success
    ).toBe(false);
    expect(
      messagingSettingsPatchSchema.safeParse({ retentionDays: 180 }).success
    ).toBe(true);
  });

  it("rejects char fields above 5000", () => {
    expect(
      messagingSettingsPatchSchema.safeParse({ messageMaxChars: 5001 }).success
    ).toBe(false);
  });

  it("validateMessagingSettingsMerge uses current values for cross-field rules", () => {
    const bad = validateMessagingSettingsMerge(DEFAULT_MESSAGING_SETTINGS, {
      freeDailyNew: 50,
    });
    expect(bad.ok).toBe(false);

    const good = validateMessagingSettingsMerge(DEFAULT_MESSAGING_SETTINGS, {
      freeDailyNew: 2,
    });
    expect(good.ok).toBe(true);
  });
});

describe("updateMessagingSettings audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateMessagingSettingsCache();
  });

  it("writes audit metadata with only changed fields", async () => {
    const beforeRow = {
      id: "default",
      ...DEFAULT_MESSAGING_SETTINGS,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedBy: null,
    };
    const afterRow = {
      ...beforeRow,
      freeDailyNew: 2,
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedBy: "admin@example.com",
    };

    selectLimit.mockResolvedValueOnce([beforeRow]);
    returning.mockResolvedValueOnce([afterRow]);

    const result = await updateMessagingSettings({
      patch: { freeDailyNew: 2 },
      reason: "Tighten free daily cap",
      adminEmail: "admin@example.com",
      adminUserId: "admin-1",
      now: afterRow.updatedAt,
    });

    expect(result.ok).toBe(true);
    expect(recordAdminAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "messaging_settings_changed",
        reason: "Tighten free daily cap",
        metadata: {
          before: { freeDailyNew: 3 },
          after: { freeDailyNew: 2 },
        },
      })
    );
  });
});
