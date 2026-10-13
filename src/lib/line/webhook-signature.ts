import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify LINE Messaging API webhook signature:
 * x-line-signature === base64(HMAC-SHA256(channelSecret, body))
 */
export function verifyLineWebhookSignature(
  body: string,
  signatureHeader: string | null | undefined,
  channelSecret: string
): boolean {
  if (!signatureHeader || !channelSecret) {
    return false;
  }

  const expected = createHmac("sha256", channelSecret)
    .update(body, "utf8")
    .digest("base64");

  const providedBuf = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}
