import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireVerifiedRecruiter = vi.fn();
const deniedVerifiedRecruiterResponse = vi.fn(
  (result: { error: string; reason: string; status: number }) => ({
    json: async () => ({ error: result.error, reason: result.reason }),
    status: result.status,
  })
);
const isStripeConfigured = vi.fn();
const createPortal = vi.fn();
const limit = vi.fn();

vi.mock("@/lib/recruiter-access", () => ({
  requireVerifiedRecruiter: (...args: unknown[]) =>
    requireVerifiedRecruiter(...args),
  deniedVerifiedRecruiterResponse: (...args: unknown[]) =>
    deniedVerifiedRecruiterResponse(...args),
}));

vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => isStripeConfigured(),
  stripe: {
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => createPortal(...args),
      },
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit,
        }),
      }),
    }),
  },
  subscriptions: {
    userId: "user_id",
    stripeCustomerId: "stripe_customer_id",
  },
}));

import { POST } from "../route";

function request(): NextRequest {
  return {
    headers: { get: () => "http://localhost:3000" },
  } as unknown as NextRequest;
}

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isStripeConfigured.mockReturnValue(true);
    createPortal.mockResolvedValue({ url: "https://billing.stripe.com/session" });
    limit.mockResolvedValue([{ stripeCustomerId: "cus_123" }]);
    requireVerifiedRecruiter.mockResolvedValue({
      ok: true,
      user: { userId: "user-1", email: "recruiter@example.com", role: "recruiter" },
      access: { isVerified: true },
    });
  });

  it("returns 403 when the recruiter is not verified", async () => {
    requireVerifiedRecruiter.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Recruiter not verified",
      reason: "recruiter_not_verified",
    });

    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(createPortal).not.toHaveBeenCalled();
  });

  it("returns 403 when a verified recruiter has no Stripe customer", async () => {
    limit.mockResolvedValue([{ stripeCustomerId: null }]);

    const response = await POST(request());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "No Stripe customer for this account",
    });
    expect(createPortal).not.toHaveBeenCalled();
  });

  it("creates a portal session for a verified recruiter with a Stripe customer", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/session",
    });
    expect(createPortal).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/recruiter/billing",
    });
  });

  it("does not open the portal when Stripe is not configured", async () => {
    isStripeConfigured.mockReturnValue(false);

    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(createPortal).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });
});
