import { describe, expect, it } from "vitest";
import { presentRecruiterBilling } from "../summary";

const base = {
  isVerified: true,
  stripeConfigured: true,
  hasStripeCustomer: true,
  billingAccessMode: "enforced" as const,
  paidAccess: false,
  passAccess: false,
  adminGrantAccess: false,
  subscriptionStatus: null,
  billingProduct: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  passExpiresAt: null,
  grantExpiresAt: null,
  grantLifetime: false,
};

describe("presentRecruiterBilling", () => {
  it("shows a 7-day pass expiry and no renewal", () => {
    const view = presentRecruiterBilling({
      ...base,
      passAccess: true,
      passExpiresAt: "2026-11-06T00:00:00.000Z",
    });

    expect(view.plan).toBe("pass_7d");
    expect(view.showExpiry).toBe(true);
    expect(view.showRenewal).toBe(false);
    expect(view.renewalAt).toBeNull();
    expect(view.expiresAt).toBe("2026-11-06T00:00:00.000Z");
    expect(view.showSubscribe).toBe(false);
    expect(view.showManage).toBe(true);
  });

  it("shows a subscription renewal date", () => {
    const view = presentRecruiterBilling({
      ...base,
      paidAccess: true,
      billingProduct: "monthly",
      subscriptionStatus: "active",
      currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    });

    expect(view.plan).toBe("monthly");
    expect(view.status).toBe("active");
    expect(view.showRenewal).toBe(true);
    expect(view.showExpiry).toBe(false);
    expect(view.renewalAt).toBe("2026-12-01T00:00:00.000Z");
  });

  it("offers pricing when there is no plan and hides manage without Stripe", () => {
    const view = presentRecruiterBilling({
      ...base,
      stripeConfigured: false,
      hasStripeCustomer: false,
    });

    expect(view.hasPlan).toBe(false);
    expect(view.showSubscribe).toBe(true);
    expect(view.showManage).toBe(false);
  });

  it("hides manage for a verified recruiter with no Stripe customer", () => {
    const view = presentRecruiterBilling({
      ...base,
      hasStripeCustomer: false,
      paidAccess: true,
      billingProduct: "annual",
      subscriptionStatus: "active",
    });

    expect(view.showManage).toBe(false);
    expect(view.plan).toBe("annual");
  });
});
