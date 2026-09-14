import { isValidSignupIntentRole } from "@/lib/auth/sign-in-decision";
import type { UserRole } from "@/types/auth";

export const SIGNUP_INTENT_COOKIE = "signup_intent_role";
export const SIGNUP_INTENT_MAX_AGE_SECONDS = 10 * 60;

export interface SignupIntentCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

/**
 * Cookie options for the pre-auth signup role intent.
 * Role only — never date of birth or other sensitive data.
 */
export function getSignupIntentCookieOptions(
  isProduction: boolean
): SignupIntentCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: SIGNUP_INTENT_MAX_AGE_SECONDS,
  };
}

export function parseSignupIntentRole(
  value: string | undefined | null
): UserRole | undefined {
  if (value == null || !isValidSignupIntentRole(value)) {
    return undefined;
  }
  return value;
}
