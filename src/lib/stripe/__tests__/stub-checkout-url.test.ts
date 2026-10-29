import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe/client", () => ({
  stripe: null,
}));

describe("createCheckoutSession stub URL", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("appends session_id without a second question mark", async () => {
    const { createCheckoutSession } = await import("../index");
    const successUrl =
      "http://localhost:3000/recruiter/dashboard?subscription=success";
    const result = await createCheckoutSession({
      userId: "user-1",
      userEmail: "recruiter@example.com",
      priceId: "price_stub",
      mode: "subscription",
      successUrl,
      cancelUrl:
        "http://localhost:3000/recruiter/dashboard?subscription=cancelled",
      metadata: { userId: "user-1" },
    });

    expect(result.sessionId.startsWith("stub_session_")).toBe(true);
    const url = new URL(result.url ?? "");
    expect(url.searchParams.get("subscription")).toBe("success");
    expect(url.searchParams.get("session_id")).toBe(result.sessionId);
    expect(result.url?.includes("??")).toBe(false);
    expect((result.url?.match(/\?/g) ?? []).length).toBe(1);
  });
});
