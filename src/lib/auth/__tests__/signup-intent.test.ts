import { describe, it, expect } from "vitest";
import {
  SIGNUP_INTENT_COOKIE,
  SIGNUP_INTENT_MAX_AGE_SECONDS,
  consumeSignupIntentCookie,
  getClearedSignupIntentCookieOptions,
  getSignupIntentCookieOptions,
  parseSignupIntentRole,
  shouldConsumeSignupIntent,
} from "../signup-intent";

describe("signup intent cookie", () => {
  it("stores only the cookie name signup_intent_role", () => {
    expect(SIGNUP_INTENT_COOKIE).toBe("signup_intent_role");
  });

  it("uses a short lifetime", () => {
    expect(SIGNUP_INTENT_MAX_AGE_SECONDS).toBe(10 * 60);
  });

  it("is HttpOnly, SameSite=Lax, path=/, and Secure in production", () => {
    const production = getSignupIntentCookieOptions(true);
    expect(production).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: SIGNUP_INTENT_MAX_AGE_SECONDS,
    });
  });

  it("does not set Secure outside production", () => {
    const local = getSignupIntentCookieOptions(false);
    expect(local.secure).toBe(false);
    expect(local.httpOnly).toBe(true);
    expect(local.sameSite).toBe("lax");
  });

  it("accepts only worker or recruiter", () => {
    expect(parseSignupIntentRole("worker")).toBe("worker");
    expect(parseSignupIntentRole("recruiter")).toBe("recruiter");
    expect(parseSignupIntentRole("admin")).toBeUndefined();
    expect(parseSignupIntentRole("")).toBeUndefined();
    expect(parseSignupIntentRole(null)).toBeUndefined();
    expect(parseSignupIntentRole(undefined)).toBeUndefined();
  });
});

describe("signup intent consumption", () => {
  it("clears after successful new-user and existing-user auth, not abort", () => {
    expect(shouldConsumeSignupIntent("create_and_complete")).toBe(true);
    expect(shouldConsumeSignupIntent("complete_existing")).toBe(true);
    expect(shouldConsumeSignupIntent("abort_redirect")).toBe(false);
  });

  it("expires the cookie with the same HttpOnly/SameSite/Secure/path flags", () => {
    const production = getClearedSignupIntentCookieOptions(true);
    expect(production).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 0,
    });

    const local = getClearedSignupIntentCookieOptions(false);
    expect(local.httpOnly).toBe(true);
    expect(local.sameSite).toBe("lax");
    expect(local.secure).toBe(false);
    expect(local.path).toBe("/");
    expect(local.maxAge).toBe(0);
  });

  it("writes an empty expired cookie to consume stale intent", () => {
    const writes: Array<{
      name: string;
      value: string;
      maxAge: number;
      httpOnly: boolean;
      sameSite: string;
    }> = [];

    consumeSignupIntentCookie(
      {
        set(name, value, options): void {
          writes.push({
            name,
            value,
            maxAge: options.maxAge,
            httpOnly: options.httpOnly,
            sameSite: options.sameSite,
          });
        },
      },
      true
    );

    expect(writes).toEqual([
      {
        name: SIGNUP_INTENT_COOKIE,
        value: "",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      },
    ]);
  });
});

