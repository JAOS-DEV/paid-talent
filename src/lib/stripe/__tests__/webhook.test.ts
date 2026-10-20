import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const insertValues = vi.fn();
const insertOnConflict = vi.fn();
const selectLimit = vi.fn();
const subscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => subscriptionsRetrieve(...args),
    },
  },
}));

vi.mock("@/lib/billing/price-settings", () => ({
  getBillingPriceSettings: vi.fn(async () => ({
    monthlyPriceId: "price_monthly",
    annualPriceId: "price_annual",
    pass7dPriceId: "price_pass",
  })),
  priceIdForProduct: vi.fn(
    (
      settings: { monthlyPriceId: string },
      product: string
    ) => (product === "monthly" ? settings.monthlyPriceId : null)
  ),
}));

vi.mock("@/lib/entitlements", () => ({
  getEffectiveEntitlement: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const insert = vi.fn(() => ({
    values: (...args: unknown[]) => {
      insertValues(...args);
      return {
        onConflictDoUpdate: (...conflictArgs: unknown[]) => {
          insertOnConflict(...conflictArgs);
          return Promise.resolve();
        },
        onConflictDoNothing: (...conflictArgs: unknown[]) => {
          insertOnConflict(...conflictArgs);
          return Promise.resolve();
        },
      };
    },
  }));

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: selectLimit,
        })),
        limit: selectLimit,
      })),
    })),
  }));

  return {
    db: {
      insert,
      select,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    },
    subscriptions: {
      userId: "user_id",
      stripeSubscriptionId: "stripe_subscription_id",
    },
    topTalentPasses: {
      userId: "user_id",
      expiresAt: "expires_at",
      stripeCheckoutSessionId: "stripe_checkout_session_id",
    },
  };
});

import { addUtcDays } from "@/lib/entitlements/resolve";
import { handleWebhookEvent } from "../index";

describe("handleWebhookEvent checkout.session.completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimit.mockResolvedValue([]);
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_1",
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_086_400,
      items: { data: [{ price: { id: "price_monthly" } }] },
    });
  });

  it("stores subscription price/product/launch flag", async () => {
    const session = {
      id: "cs_sub",
      mode: "subscription",
      customer: "cus_1",
      subscription: "sub_1",
      metadata: {
        userId: "user-1",
        product: "monthly",
        launch: "1",
      },
    } as unknown as Stripe.Checkout.Session;

    const result = await handleWebhookEvent({
      type: "checkout.session.completed",
      data: { object: session },
    } as Stripe.Event);

    expect(result.handled).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        stripePriceId: "price_monthly",
        billingProduct: "monthly",
        launchDiscountApplied: true,
        plan: "top_talent_unlock",
        status: "active",
      })
    );
  });

  it("creates a 7-day pass idempotently and stacks from current expiry", async () => {
    const currentExpiry = addUtcDays(new Date(), 2);
    selectLimit.mockResolvedValue([{ expiresAt: currentExpiry }]);

    const session = {
      id: "cs_pass_1",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_1",
      amount_total: 19000,
      currency: "thb",
      metadata: {
        userId: "user-1",
        product: "pass_7d",
        firstPass: "1",
      },
    } as unknown as Stripe.Checkout.Session;

    const event = {
      type: "checkout.session.completed",
      data: { object: session },
    } as Stripe.Event;

    await handleWebhookEvent(event);
    await handleWebhookEvent(event);

    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        stripeCheckoutSessionId: "cs_pass_1",
        usedFirstPassCoupon: true,
        startsAt: currentExpiry,
        expiresAt: addUtcDays(currentExpiry, 7),
      })
    );
    expect(insertOnConflict).toHaveBeenCalled();
  });
});
