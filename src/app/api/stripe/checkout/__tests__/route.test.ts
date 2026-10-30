import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireVerifiedRecruiter = vi.fn();
const deniedVerifiedRecruiterResponse = vi.fn(
  (result: { error: string; reason: string; status: number }) => ({
    json: async () => ({ error: result.error, reason: result.reason }),
    status: result.status,
  })
);
const getBillingAccessMode = vi.fn();
const getBillingPriceSettings = vi.fn();
const countLaunchDiscountSeatsUsed = vi.fn();
const createCheckoutSession = vi.fn();
const selectLimit = vi.fn();

vi.mock("@/lib/recruiter-access", () => ({
  requireVerifiedRecruiter: (...args: unknown[]) =>
    requireVerifiedRecruiter(...args),
  deniedVerifiedRecruiterResponse: (...args: unknown[]) =>
    deniedVerifiedRecruiterResponse(...args),
}));

vi.mock("@/lib/platform-settings", () => ({
  getBillingAccessMode: (...args: unknown[]) => getBillingAccessMode(...args),
}));

vi.mock("@/lib/billing/price-settings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/billing/price-settings")>();
  return {
    ...actual,
    getBillingPriceSettings: (...args: unknown[]) =>
      getBillingPriceSettings(...args),
    countLaunchDiscountSeatsUsed: (...args: unknown[]) =>
      countLaunchDiscountSeatsUsed(...args),
  };
});

vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
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
  },
  subscriptions: {
    userId: "user_id",
    status: "status",
    plan: "plan",
    currentPeriodEnd: "current_period_end",
    cancelAtPeriodEnd: "cancel_at_period_end",
    stripeCustomerId: "stripe_customer_id",
    stripeSubscriptionId: "stripe_subscription_id",
    launchDiscountApplied: "launch_discount_applied",
  },
  topTalentPasses: {
    id: "id",
    userId: "user_id",
  },
}));

import { POST } from "../route";

function verifiedActor() {
  return {
    ok: true as const,
    user: {
      userId: "user-1",
      email: "recruiter@example.com",
      role: "recruiter" as const,
    },
    access: { isVerified: true },
  };
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    id: "default",
    monthlyPriceId: "price_monthly",
    annualPriceId: "price_annual",
    pass7dPriceId: "price_pass",
    launchCouponId: "coupon_launch",
    launchEnabled: false,
    launchSeatsLimit: 50,
    firstPassCouponId: "coupon_first_pass",
    updatedAt: new Date(),
    updatedBy: null,
    ...overrides,
  };
}

function request(body?: unknown): NextRequest {
  return {
    json: async () => body ?? {},
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "origin" ? "https://evil.example" : null,
    },
  } as unknown as NextRequest;
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireVerifiedRecruiter.mockResolvedValue(verifiedActor());
    getBillingAccessMode.mockResolvedValue("enforced");
    getBillingPriceSettings.mockResolvedValue(settings());
    countLaunchDiscountSeatsUsed.mockResolvedValue(0);
    createCheckoutSession.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
      sessionId: "cs_test",
    });
    // Default: no subscription, no passes, never used launch
    selectLimit.mockResolvedValue([]);
  });

  it("returns 403 recruiter_not_verified for unverified recruiters", async () => {
    requireVerifiedRecruiter.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Recruiter not verified",
      reason: "recruiter_not_verified",
    });

    const response = await POST(request({ product: "monthly" }));
    expect(response.status).toBe(403);
    expect(deniedVerifiedRecruiterResponse).toHaveBeenCalled();
  });

  it("builds checkout URLs from the app base and ignores Origin", async () => {
    vi.stubEnv("AUTH_URL", "https://app.example");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example");
    selectLimit.mockResolvedValue([]);

    await POST(request({ product: "monthly" }));

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://app.example/recruiter/dashboard?subscription=success",
        cancelUrl: "https://app.example/recruiter/dashboard?subscription=cancelled",
      })
    );
    expect(JSON.stringify(createCheckoutSession.mock.calls)).not.toContain(
      "evil.example"
    );
    vi.unstubAllEnvs();
  });

  it("uses NEXT_PUBLIC_APP_URL for checkout when AUTH_URL is unset", async () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example");
    selectLimit.mockResolvedValue([]);

    await POST(request({ product: "annual" }));

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl:
          "https://public.example/recruiter/dashboard?subscription=success",
        cancelUrl:
          "https://public.example/recruiter/dashboard?subscription=cancelled",
      })
    );
    expect(JSON.stringify(createCheckoutSession.mock.calls)).not.toContain(
      "evil.example"
    );
    vi.unstubAllEnvs();
  });

  it("returns 409 when open_access", async () => {
    getBillingAccessMode.mockResolvedValue("open_access");
    const response = await POST(request({ product: "monthly" }));
    expect(response.status).toBe(409);
  });

  it("returns 503 when price is not configured", async () => {
    getBillingPriceSettings.mockResolvedValue(
      settings({ monthlyPriceId: null })
    );
    const response = await POST(request({ product: "monthly" }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe("price_not_configured");
  });

  it("returns 409 when recruiter already has an active subscription", async () => {
    selectLimit.mockResolvedValueOnce([
      {
        status: "active",
        plan: "top_talent_unlock",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      },
    ]);

    const response = await POST(request({ product: "pass_7d" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.reason).toBe("active_subscription");
  });

  it("applies launch coupon only when enabled, seats remain, and never used", async () => {
    getBillingPriceSettings.mockResolvedValue(
      settings({ launchEnabled: true })
    );
    countLaunchDiscountSeatsUsed.mockResolvedValue(10);
    // hasActivePaidSubscription → []; userEverHadLaunchDiscount → []
    selectLimit.mockResolvedValue([]);

    await POST(request({ product: "monthly" }));

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        priceId: "price_monthly",
        discounts: [{ coupon: "coupon_launch" }],
        metadata: expect.objectContaining({
          userId: "user-1",
          product: "monthly",
          launch: "1",
        }),
      })
    );
  });

  it("does not apply launch coupon when seats are exhausted", async () => {
    getBillingPriceSettings.mockResolvedValue(
      settings({ launchEnabled: true })
    );
    countLaunchDiscountSeatsUsed.mockResolvedValue(50);
    selectLimit.mockResolvedValue([]);

    await POST(request({ product: "monthly" }));

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: undefined,
        metadata: expect.not.objectContaining({ launch: "1" }),
      })
    );
  });

  it("applies first-pass coupon only for the first pass purchase", async () => {
    // active sub check → []; userHasAnyPass → []
    selectLimit.mockResolvedValue([]);

    await POST(request({ product: "pass_7d" }));

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        priceId: "price_pass",
        discounts: [{ coupon: "coupon_first_pass" }],
        metadata: expect.objectContaining({
          product: "pass_7d",
          firstPass: "1",
        }),
      })
    );
  });

  it("skips first-pass coupon when user already bought a pass", async () => {
    selectLimit
      .mockResolvedValueOnce([]) // active sub
      .mockResolvedValueOnce([{ id: "pass-1" }]); // existing pass

    await POST(request({ product: "pass_7d" }));

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        discounts: undefined,
        metadata: expect.objectContaining({ firstPass: "0" }),
      })
    );
  });
});
