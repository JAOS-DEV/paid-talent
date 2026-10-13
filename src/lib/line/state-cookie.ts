import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const LINE_LINK_STATE_COOKIE = "line_link_oauth";
export const LINE_LINK_STATE_MAX_AGE_SEC = 10 * 60;

export interface LineLinkOAuthPayload {
  state: string;
  nonce: string;
  exp: number;
  userId: string;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required to sign LINE link state");
  }
  return secret;
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function createLineLinkOAuthPayload(
  userId: string,
  nowMs: number = Date.now()
): LineLinkOAuthPayload {
  return {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    exp: nowMs + LINE_LINK_STATE_MAX_AGE_SEC * 1000,
    userId,
  };
}

/** Serialize and HMAC-sign a payload for the httpOnly cookie. */
export function signLineLinkStateCookie(
  payload: LineLinkOAuthPayload,
  secret: string = getAuthSecret()
): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify cookie signature and expiry. Returns null if tampered, expired, or malformed.
 */
export function verifyLineLinkStateCookie(
  cookieValue: string | undefined | null,
  secret: string = getAuthSecret(),
  nowMs: number = Date.now()
): LineLinkOAuthPayload | null {
  if (!cookieValue || !cookieValue.includes(".")) {
    return null;
  }

  const lastDot = cookieValue.lastIndexOf(".");
  const payloadB64 = cookieValue.slice(0, lastDot);
  const sig = cookieValue.slice(lastDot + 1);
  if (!payloadB64 || !sig) {
    return null;
  }

  const expected = sign(payloadB64, secret);
  if (!safeEqual(sig, expected)) {
    return null;
  }

  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<LineLinkOAuthPayload>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.userId !== "string" ||
      !parsed.userId
    ) {
      return null;
    }
    if (parsed.exp < nowMs) {
      return null;
    }
    return {
      state: parsed.state,
      nonce: parsed.nonce,
      exp: parsed.exp,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

/** Constant-time compare of OAuth `state` query param vs cookie payload. */
export function statesMatch(
  queryState: string | null | undefined,
  cookieState: string
): boolean {
  if (!queryState) return false;
  return safeEqual(queryState, cookieState);
}
