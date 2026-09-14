import { describe, it, expect } from "vitest";
import {
  SIGNUP_INTENT_COOKIE,
  SIGNUP_INTENT_MAX_AGE_SECONDS,
  getSignupIntentCookieOptions,
  parseSignupIntentRole,
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
