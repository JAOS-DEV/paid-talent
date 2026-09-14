import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  resolveAdminGrantWindow,
  resolveEffectiveEntitlement,
} from "../resolve";

const now = new Date("2026-09-14T12:00:00.000Z");

describe("resolveEffectiveEntitlement", () => {
  it("denies premium when enforced with no paid subscription or admin grant", () => {
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "enforced",
      paidSubscription: null,
      adminGrant: null,
      now,
    });
    expect(result.hasPremiumAccess).toBe(false);
    expect(result.sources).toEqual([]);
  });

  it("grants premium for a valid paid subscription in enforced mode", () => {
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "enforced",
      paidSubscription: {
        status: "active",
        plan: "top_talent_unlock",
        stripeBacked: true,
      },
      adminGrant: null,
      now,
    });
    expect(result.hasPremiumAccess).toBe(true);
    expect(result.paidAccess).toBe(true);
    expect(result.sources).toEqual(["paid_subscription"]);
  });

  it("grants premium for a temporary admin grant in enforced mode", () => {
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "enforced",
      paidSubscription: null,
      adminGrant: {
        id: "g1",
        isLifetime: false,
        startsAt: now,
        expiresAt: addUtcDays(now, 7),
        reason: "support",
        grantedByAdminEmail: "admin@example.com",
      },
      now,
    });
    expect(result.hasPremiumAccess).toBe(true);
    expect(result.adminGrantAccess).toBe(true);
    expect(result.sources).toEqual(["admin_grant"]);
  });

  it("grants premium for a lifetime admin grant without a far-future date", () => {
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "enforced",
      paidSubscription: null,
      adminGrant: {
        id: "g2",
        isLifetime: true,
        startsAt: now,
        expiresAt: null,
        reason: "partner",
        grantedByAdminEmail: "admin@example.com",
      },
      now,
    });
    expect(result.hasPremiumAccess).toBe(true);
    expect(result.sources).toEqual(["lifetime_admin_grant"]);
    expect(result.adminGrant?.expiresAt).toBeNull();
  });

  it("denies premium for an expired admin grant unless paid", () => {
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "enforced",
      paidSubscription: null,
      adminGrant: {
        id: "g3",
        isLifetime: false,
        startsAt: addUtcDays(now, -14),
        expiresAt: addUtcDays(now, -1),
        reason: "trial",
        grantedByAdminEmail: "admin@example.com",
      },
      now,
    });
    expect(result.hasPremiumAccess).toBe(false);
  });

  it("grants premium in open_access without a subscription", () => {
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "open_access",
      paidSubscription: null,
      adminGrant: null,
      now,
    });
    expect(result.hasPremiumAccess).toBe(true);
    expect(result.sources).toEqual(["open_access"]);
    expect(result.paidAccess).toBe(false);
  });

  it("keeps paid state intact during open_access", () => {
    const paid = {
      status: "active" as const,
      plan: "top_talent_unlock" as const,
      stripeBacked: true,
      currentPeriodEnd: addUtcDays(now, 20),
    };
    const result = resolveEffectiveEntitlement({
      billingAccessMode: "open_access",
      paidSubscription: paid,
      adminGrant: null,
      now,
    });
    expect(result.hasPremiumAccess).toBe(true);
    expect(result.paidSubscription).toEqual(paid);
    expect(result.sources).toContain("open_access");
    expect(result.sources).toContain("paid_subscription");
  });

  it("falls back to actual paid/admin state after switching to enforced", () => {
    const granted = resolveEffectiveEntitlement({
      billingAccessMode: "open_access",
      paidSubscription: null,
      adminGrant: null,
      now,
    });
    expect(granted.hasPremiumAccess).toBe(true);

    const enforced = resolveEffectiveEntitlement({
      billingAccessMode: "enforced",
      paidSubscription: null,
      adminGrant: null,
      now,
    });
    expect(enforced.hasPremiumAccess).toBe(false);
  });
});

describe("resolveAdminGrantWindow", () => {
  it("grants 7/14/30/90 days from now when no grant exists", () => {
    for (const days of [7, 14, 30, 90]) {
      const window = resolveAdminGrantWindow({
        now,
        currentActiveGrant: null,
        requested: { kind: "days", days },
      });
      expect(window.action).toBe("grant");
      expect(window.isLifetime).toBe(false);
      expect(window.expiresAt).toEqual(addUtcDays(now, days));
    }
  });

  it("extends from the later of now and current expiry", () => {
    const currentExpiry = addUtcDays(now, 10);
    const window = resolveAdminGrantWindow({
      now,
      currentActiveGrant: {
        id: "g1",
        isLifetime: false,
        startsAt: addUtcDays(now, -2),
        expiresAt: currentExpiry,
        reason: "support",
        grantedByAdminEmail: "admin@example.com",
      },
      requested: { kind: "days", days: 7 },
    });
    expect(window.action).toBe("extend");
    expect(window.expiresAt).toEqual(addUtcDays(currentExpiry, 7));
    expect(window.shortened).toBe(false);
  });

  it("does not shorten an existing grant with an earlier custom expiry", () => {
    const currentExpiry = addUtcDays(now, 40);
    const window = resolveAdminGrantWindow({
      now,
      currentActiveGrant: {
        id: "g1",
        isLifetime: false,
        startsAt: now,
        expiresAt: currentExpiry,
        reason: "support",
        grantedByAdminEmail: "admin@example.com",
      },
      requested: { kind: "custom", expiresAt: addUtcDays(now, 5) },
    });
    expect(window.expiresAt).toEqual(currentExpiry);
  });

  it("represents lifetime with a null expiry instead of a fake far-future date", () => {
    const window = resolveAdminGrantWindow({
      now,
      currentActiveGrant: null,
      requested: { kind: "lifetime" },
    });
    expect(window.isLifetime).toBe(true);
    expect(window.expiresAt).toBeNull();
    expect(window.action).toBe("lifetime");
  });

  it("does not convert an existing lifetime grant into a dated grant", () => {
    const window = resolveAdminGrantWindow({
      now,
      currentActiveGrant: {
        id: "g1",
        isLifetime: true,
        startsAt: now,
        expiresAt: null,
        reason: "partner",
        grantedByAdminEmail: "admin@example.com",
      },
      requested: { kind: "days", days: 7 },
    });
    expect(window.isLifetime).toBe(true);
    expect(window.expiresAt).toBeNull();
  });
});
