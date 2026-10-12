import { describe, expect, it, vi, beforeEach } from "vitest";
import { bangkokDayRange, evaluateNewRequest } from "@/lib/messaging/caps";
import { DEFAULT_MESSAGING_SETTINGS } from "@/lib/messaging/settings";
import { capDenyError } from "../errors";

describe("contact request cap mapping", () => {
  it("maps daily_limit to 429 with bangkok day retryAfter", () => {
    const now = new Date("2026-03-15T10:00:00+07:00");
    const result = evaluateNewRequest({
      tier: "free",
      isPaused: false,
      openAccess: false,
      verifiedAt: new Date("2025-01-01"),
      now,
      settings: DEFAULT_MESSAGING_SETTINGS,
      counts: {
        last24h: 3,
        last7d: 3,
        pending: 0,
        topTalentLast24h: 0,
      },
      target: { isTopTalent: false },
      hasOpenRequestToTarget: false,
      lastDeclinedByTargetAt: null,
      isBlockedEitherWay: false,
      openerLength: 20,
      hasOpeningAttached: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("daily_limit");
    expect(result.retryAfter?.getTime()).toBe(bangkokDayRange(now).end.getTime());

    const mapped = capDenyError(result.reason, result.retryAfter);
    expect(mapped.status).toBe(429);
    expect(mapped.code).toBe("daily_limit");
  });

  it("denies free contacting Top Talent without open access", () => {
    const result = evaluateNewRequest({
      tier: "free",
      isPaused: false,
      openAccess: false,
      verifiedAt: new Date("2025-01-01"),
      now: new Date(),
      settings: DEFAULT_MESSAGING_SETTINGS,
      counts: {
        last24h: 0,
        last7d: 0,
        pending: 0,
        topTalentLast24h: 0,
      },
      target: { isTopTalent: true },
      hasOpenRequestToTarget: false,
      lastDeclinedByTargetAt: null,
      isBlockedEitherWay: false,
      openerLength: 20,
      hasOpeningAttached: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("top_talent_requires_pro");
    expect(capDenyError(result.reason).status).toBe(403);
  });

  it("denies unverified and paused", () => {
    expect(
      evaluateNewRequest({
        tier: "unverified",
        isPaused: false,
        openAccess: false,
        verifiedAt: null,
        now: new Date(),
        settings: DEFAULT_MESSAGING_SETTINGS,
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
        openerLength: 10,
        hasOpeningAttached: false,
      })
    ).toMatchObject({ ok: false, reason: "not_verified" });

    expect(
      evaluateNewRequest({
        tier: "free",
        isPaused: true,
        openAccess: false,
        verifiedAt: new Date(),
        now: new Date(),
        settings: DEFAULT_MESSAGING_SETTINGS,
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
        openerLength: 10,
        hasOpeningAttached: false,
      })
    ).toMatchObject({ ok: false, reason: "paused" });
  });
});

describe("contact info blocked", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("containsBlockedContact rejects phone numbers", async () => {
    const { containsBlockedContact } = await import(
      "@/lib/helpers/text-filter"
    );
    expect(containsBlockedContact("Call me at 0812345678")).toBe(true);
    expect(containsBlockedContact("Looking for a bartender this week")).toBe(
      false
    );
  });
});
