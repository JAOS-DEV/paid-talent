import { describe, expect, it } from "vitest";
import {
  createLineLinkOAuthPayload,
  signLineLinkStateCookie,
  statesMatch,
  verifyLineLinkStateCookie,
} from "@/lib/line/state-cookie";

const SECRET = "test-auth-secret-for-line-link";

describe("LINE link state cookie", () => {
  it("signs and verifies a payload including userId", () => {
    const payload = createLineLinkOAuthPayload("user-a", 1_700_000_000_000);
    const cookie = signLineLinkStateCookie(payload, SECRET);
    const verified = verifyLineLinkStateCookie(
      cookie,
      SECRET,
      1_700_000_000_000
    );
    expect(verified).toEqual(payload);
    expect(verified?.userId).toBe("user-a");
  });

  it("rejects tampered cookie", () => {
    const payload = createLineLinkOAuthPayload("user-a", 1_700_000_000_000);
    const cookie = signLineLinkStateCookie(payload, SECRET);
    const tampered = cookie.slice(0, -4) + "xxxx";
    expect(
      verifyLineLinkStateCookie(tampered, SECRET, 1_700_000_000_000)
    ).toBeNull();
  });

  it("rejects expired cookie", () => {
    const payload = createLineLinkOAuthPayload("user-a", 1_700_000_000_000);
    const cookie = signLineLinkStateCookie(payload, SECRET);
    expect(
      verifyLineLinkStateCookie(cookie, SECRET, payload.exp + 1)
    ).toBeNull();
  });

  it("statesMatch rejects mismatched state", () => {
    expect(statesMatch("abc", "abd")).toBe(false);
    expect(statesMatch(null, "abc")).toBe(false);
    expect(statesMatch("abc", "abc")).toBe(true);
  });
});
