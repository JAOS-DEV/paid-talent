import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyLineWebhookSignature } from "@/lib/line/webhook-signature";

describe("verifyLineWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const body = '{"events":[]}';
    const secret = "channel-secret";
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(verifyLineWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects missing signature", () => {
    expect(verifyLineWebhookSignature("{}", null, "secret")).toBe(false);
    expect(verifyLineWebhookSignature("{}", undefined, "secret")).toBe(false);
    expect(verifyLineWebhookSignature("{}", "", "secret")).toBe(false);
  });

  it("rejects invalid signature", () => {
    expect(
      verifyLineWebhookSignature('{"events":[]}', "not-valid", "secret")
    ).toBe(false);
  });
});
