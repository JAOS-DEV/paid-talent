import { describe, expect, it } from "vitest";
import {
  bangkokDayRange,
  effectiveLimitsFor,
  evaluateNewRequest,
  resolveWorkerInboundLimit,
  workerInboundDecision,
  type CapDenyReason,
} from "../caps";
import {
  DEFAULT_MESSAGING_SETTINGS,
  type MessagingSettings,
} from "../settings";

const NOW = new Date("2026-06-15T10:00:00.000Z");
const VERIFIED_OLD = new Date("2025-01-01T00:00:00.000Z");
const VERIFIED_RECENT = new Date("2026-06-14T10:00:00.000Z");

function settings(overrides: Partial<MessagingSettings> = {}): MessagingSettings {
  return { ...DEFAULT_MESSAGING_SETTINGS, ...overrides };
}

function baseInput(
  overrides: Partial<Parameters<typeof evaluateNewRequest>[0]> = {}
): Parameters<typeof evaluateNewRequest>[0] {
  return {
    tier: "free",
    isPaused: false,
    openAccess: false,
    verifiedAt: VERIFIED_OLD,
    now: NOW,
    settings: settings(),
    counts: {
      last24h: 0,
      last7d: 0,
      pending: 0,
      topTalentLast24h: 0,
    },
    target: { isTopTalent: false },
    hasOpenRequestToTarget: false,
    lastDeclinedByTargetAt: null,
    isBlockedEitherWay: false,
    openerLength: 50,
    hasOpeningAttached: false,
    ...overrides,
  };
}

describe("bangkokDayRange", () => {
  it("rolls at 17:00 UTC (midnight Bangkok)", () => {
    const before = bangkokDayRange(new Date("2026-01-01T16:59:59.999Z"));
    expect(before.start.toISOString()).toBe("2025-12-31T17:00:00.000Z");
    expect(before.end.toISOString()).toBe("2026-01-01T17:00:00.000Z");

    const atMidnight = bangkokDayRange(new Date("2026-01-01T17:00:00.000Z"));
    expect(atMidnight.start.toISOString()).toBe("2026-01-01T17:00:00.000Z");
    expect(atMidnight.end.toISOString()).toBe("2026-01-02T17:00:00.000Z");
  });
});

describe("effectiveLimitsFor", () => {
  it("applies free caps and never upgrades for open access callers", () => {
    const limits = effectiveLimitsFor("free", settings(), VERIFIED_OLD, NOW);
    expect(limits.dailyNew).toBe(3);
    expect(limits.weeklyNew).toBe(10);
    expect(limits.pendingMax).toBe(5);
    expect(limits.openerMaxChars).toBe(300);
    expect(limits.maxVenues).toBe(1);
    expect(limits.canAttachOpening).toBe(false);
    expect(limits.topTalentDaily).toBeNull();
    expect(limits.isNewRecruiterHold).toBe(false);
  });

  it("applies pro caps including top talent daily", () => {
    const limits = effectiveLimitsFor("pro", settings(), VERIFIED_OLD, NOW);
    expect(limits.dailyNew).toBe(20);
    expect(limits.topTalentDaily).toBe(10);
    expect(limits.canAttachOpening).toBe(true);
  });

  it("holds new recruiters to the tighter daily cap when binding", () => {
    const limits = effectiveLimitsFor(
      "pro",
      settings(),
      VERIFIED_RECENT,
      NOW
    );
    expect(limits.dailyNew).toBe(5);
    expect(limits.isNewRecruiterHold).toBe(true);
    expect(limits.baseDailyNew).toBe(20);
  });

  it("does not mark new-recruiter hold when free daily is already lower", () => {
    const limits = effectiveLimitsFor(
      "free",
      settings(),
      VERIFIED_RECENT,
      NOW
    );
    expect(limits.dailyNew).toBe(3);
    expect(limits.isNewRecruiterHold).toBe(false);
  });
});

describe("evaluateNewRequest deny reasons", () => {
  const denyCases: Array<{
    name: string;
    reason: CapDenyReason;
    input: Partial<Parameters<typeof evaluateNewRequest>[0]>;
  }> = [
    {
      name: "not_verified",
      reason: "not_verified",
      input: { tier: "unverified" },
    },
    {
      name: "paused",
      reason: "paused",
      input: { isPaused: true },
    },
    {
      name: "blocked",
      reason: "blocked",
      input: { isBlockedEitherWay: true },
    },
    {
      name: "duplicate",
      reason: "duplicate",
      input: { hasOpenRequestToTarget: true },
    },
    {
      name: "decline_cooldown",
      reason: "decline_cooldown",
      input: {
        lastDeclinedByTargetAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    },
    {
      name: "top_talent_requires_pro",
      reason: "top_talent_requires_pro",
      input: { target: { isTopTalent: true }, openAccess: false },
    },
    {
      name: "daily_limit at boundary",
      reason: "daily_limit",
      input: { counts: { last24h: 3, last7d: 3, pending: 0, topTalentLast24h: 0 } },
    },
    {
      name: "weekly_limit at boundary",
      reason: "weekly_limit",
      input: {
        counts: { last24h: 0, last7d: 10, pending: 0, topTalentLast24h: 0 },
      },
    },
    {
      name: "pending_limit at boundary",
      reason: "pending_limit",
      input: {
        counts: { last24h: 0, last7d: 0, pending: 5, topTalentLast24h: 0 },
      },
    },
    {
      name: "top_talent_daily_limit at boundary",
      reason: "top_talent_daily_limit",
      input: {
        tier: "pro",
        target: { isTopTalent: true },
        counts: {
          last24h: 0,
          last7d: 0,
          pending: 0,
          topTalentLast24h: 10,
        },
      },
    },
    {
      name: "new_recruiter_daily_limit when binding",
      reason: "new_recruiter_daily_limit",
      input: {
        tier: "pro",
        verifiedAt: VERIFIED_RECENT,
        counts: {
          last24h: 5,
          last7d: 5,
          pending: 0,
          topTalentLast24h: 0,
        },
      },
    },
    {
      name: "opener_too_long free",
      reason: "opener_too_long",
      input: { openerLength: 301 },
    },
    {
      name: "opener_too_long pro",
      reason: "opener_too_long",
      input: { tier: "pro", openerLength: 1001 },
    },
    {
      name: "opening_attach_requires_pro",
      reason: "opening_attach_requires_pro",
      input: { hasOpeningAttached: true },
    },
  ];

  it.each(denyCases)("denies $name", ({ reason, input }) => {
    const result = evaluateNewRequest(baseInput(input));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
    }
  });

  it("allows one below daily limit", () => {
    const result = evaluateNewRequest(
      baseInput({
        counts: { last24h: 2, last7d: 2, pending: 0, topTalentLast24h: 0 },
      })
    );
    expect(result.ok).toBe(true);
  });

  it("allows one below weekly/pending/top-talent limits", () => {
    expect(
      evaluateNewRequest(
        baseInput({
          counts: { last24h: 0, last7d: 9, pending: 0, topTalentLast24h: 0 },
        })
      ).ok
    ).toBe(true);
    expect(
      evaluateNewRequest(
        baseInput({
          counts: { last24h: 0, last7d: 0, pending: 4, topTalentLast24h: 0 },
        })
      ).ok
    ).toBe(true);
    expect(
      evaluateNewRequest(
        baseInput({
          tier: "pro",
          target: { isTopTalent: true },
          counts: {
            last24h: 0,
            last7d: 0,
            pending: 0,
            topTalentLast24h: 9,
          },
        })
      ).ok
    ).toBe(true);
  });

  it("open access keeps free caps but allows Top Talent", () => {
    const allowed = evaluateNewRequest(
      baseInput({
        openAccess: true,
        target: { isTopTalent: true },
        counts: { last24h: 2, last7d: 2, pending: 0, topTalentLast24h: 0 },
      })
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.limits.dailyNew).toBe(3);
    }

    const deniedDaily = evaluateNewRequest(
      baseInput({
        openAccess: true,
        target: { isTopTalent: true },
        counts: { last24h: 3, last7d: 3, pending: 0, topTalentLast24h: 0 },
      })
    );
    expect(deniedDaily.ok).toBe(false);
    if (!deniedDaily.ok) {
      expect(deniedDaily.reason).toBe("daily_limit");
    }
  });

  it("uses daily_limit (not new-recruiter) when hold is not binding", () => {
    const result = evaluateNewRequest(
      baseInput({
        tier: "free",
        verifiedAt: VERIFIED_RECENT,
        counts: { last24h: 3, last7d: 3, pending: 0, topTalentLast24h: 0 },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("daily_limit");
    }
  });

  it("allows attach for free when free_can_attach_opening is true", () => {
    const result = evaluateNewRequest(
      baseInput({
        settings: settings({ freeCanAttachOpening: true }),
        hasOpeningAttached: true,
      })
    );
    expect(result.ok).toBe(true);
  });

  it("allows free opener exactly at max chars", () => {
    expect(evaluateNewRequest(baseInput({ openerLength: 300 })).ok).toBe(true);
    expect(evaluateNewRequest(baseInput({ openerLength: 301 })).ok).toBe(false);
  });

  it("allows pro opener exactly at max chars", () => {
    expect(
      evaluateNewRequest(baseInput({ tier: "pro", openerLength: 1000 })).ok
    ).toBe(true);
    expect(
      evaluateNewRequest(baseInput({ tier: "pro", openerLength: 1001 })).ok
    ).toBe(false);
  });

  it("returns retryAfter for decline cooldown", () => {
    const declinedAt = new Date("2026-06-01T10:00:00.000Z");
    const result = evaluateNewRequest(
      baseInput({ lastDeclinedByTargetAt: declinedAt })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfter?.toISOString()).toBe(
        new Date("2026-07-01T10:00:00.000Z").toISOString()
      );
    }
  });

  it("allows after decline cooldown expires", () => {
    const result = evaluateNewRequest(
      baseInput({
        lastDeclinedByTargetAt: new Date("2026-05-01T10:00:00.000Z"),
      })
    );
    expect(result.ok).toBe(true);
  });
});

describe("workerInboundDecision / resolveWorkerInboundLimit", () => {
  it("queues when paused or at/over limit", () => {
    expect(
      workerInboundDecision({ deliveredToday: 0, limit: 10, paused: true })
    ).toBe("queue");
    expect(
      workerInboundDecision({ deliveredToday: 10, limit: 10, paused: false })
    ).toBe("queue");
    expect(
      workerInboundDecision({ deliveredToday: 9, limit: 10, paused: false })
    ).toBe("deliver");
  });

  it("clamps preference to 1..worker_inbound_daily_default", () => {
    const s = settings({ workerInboundDailyDefault: 10 });
    expect(resolveWorkerInboundLimit(null, s)).toBe(10);
    expect(resolveWorkerInboundLimit(0, s)).toBe(1);
    expect(resolveWorkerInboundLimit(3, s)).toBe(3);
    expect(resolveWorkerInboundLimit(50, s)).toBe(10);
  });
});
