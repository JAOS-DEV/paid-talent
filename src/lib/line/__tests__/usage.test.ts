import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn();
const onConflictDoNothing = vi.fn(async () => undefined);
const updateReturning = vi.fn();
const updateWhere = vi.fn(() => ({
  returning: updateReturning,
}));
const updateSet = vi.fn(() => ({
  where: updateWhere,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (...args: unknown[]) => {
        insertValues(...args);
        return { onConflictDoNothing };
      },
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: vi.fn(async () => ({ lineMonthlyPushBudget: 2 })),
}));

import { reserveLinePushBudget } from "../usage";

describe("reserveLinePushBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onConflictDoNothing.mockResolvedValue(undefined);
  });

  it("refuses when no row returned (budget at limit)", async () => {
    updateReturning.mockResolvedValue([]);
    const result = await reserveLinePushBudget(2, new Date("2026-04-01T12:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "budget_exhausted" });
    expect(insertValues).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalled();
  });

  it("returns ok when a slot is reserved", async () => {
    updateReturning.mockResolvedValue([{ pushesSent: 1 }]);
    const result = await reserveLinePushBudget(300, new Date("2026-04-01T12:00:00Z"));
    expect(result).toEqual({ ok: true, pushesSent: 1 });
  });
});
