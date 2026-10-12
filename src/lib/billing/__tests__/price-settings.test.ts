import { beforeEach, describe, expect, it, vi } from "vitest";

const pricesRetrieve = vi.fn();
const couponsRetrieve = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    prices: { retrieve: (...args: unknown[]) => pricesRetrieve(...args) },
    coupons: { retrieve: (...args: unknown[]) => couponsRetrieve(...args) },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  billingPriceSettings: {},
  subscriptions: {},
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAuditEvent: vi.fn(),
}));

import { validatePriceIds } from "../price-settings";

describe("validatePriceIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects wrong currency and interval", async () => {
    pricesRetrieve.mockImplementation(async (id: string) => {
      if (id === "price_monthly_bad") {
        return {
          id,
          active: true,
          currency: "usd",
          type: "recurring",
          recurring: { interval: "month" },
        };
      }
      if (id === "price_annual_bad") {
        return {
          id,
          active: true,
          currency: "thb",
          type: "recurring",
          recurring: { interval: "month" },
        };
      }
      return {
        id,
        active: true,
        currency: "thb",
        type: "one_time",
      };
    });

    const result = await validatePriceIds({
      monthlyPriceId: "price_monthly_bad",
      annualPriceId: "price_annual_bad",
      pass7dPriceId: "price_pass_ok",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("currency"))).toBe(true);
      expect(result.errors.some((e) => e.includes("recurring/year"))).toBe(true);
    }
  });

  it("accepts valid THB prices and coupons", async () => {
    pricesRetrieve.mockImplementation(async (id: string) => {
      if (id === "price_monthly") {
        return {
          id,
          active: true,
          currency: "thb",
          type: "recurring",
          recurring: { interval: "month" },
        };
      }
      if (id === "price_annual") {
        return {
          id,
          active: true,
          currency: "thb",
          type: "recurring",
          recurring: { interval: "year" },
        };
      }
      return {
        id,
        active: true,
        currency: "thb",
        type: "one_time",
      };
    });
    couponsRetrieve.mockResolvedValue({ id: "coupon_1", valid: true });

    const result = await validatePriceIds({
      monthlyPriceId: "price_monthly",
      annualPriceId: "price_annual",
      pass7dPriceId: "price_pass",
      launchCouponId: "coupon_1",
      firstPassCouponId: "coupon_1",
    });

    expect(result.ok).toBe(true);
  });
});

describe("validatePriceIds stub mode", () => {
  it("returns warnings and skips Stripe calls when stripe is null", async () => {
    vi.resetModules();
    vi.doMock("@/lib/stripe/client", () => ({ stripe: null }));
    vi.doMock("@/lib/db", () => ({
      db: {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        transaction: vi.fn(),
      },
      billingPriceSettings: {},
      subscriptions: {},
    }));
    vi.doMock("@/lib/admin/audit", () => ({
      recordAdminAuditEvent: vi.fn(),
    }));

    const { validatePriceIds: validateStub } = await import("../price-settings");
    const result = await validateStub({
      monthlyPriceId: "price_anything",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/stub mode/i);
    }
  });
});
