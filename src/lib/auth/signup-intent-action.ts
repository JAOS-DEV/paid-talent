"use server";

import { cookies } from "next/headers";
import { isValidSignupIntentRole } from "@/lib/auth/sign-in-decision";
import type { UserRole } from "@/types/auth";
import {
  SIGNUP_INTENT_COOKIE,
  getSignupIntentCookieOptions,
} from "@/lib/auth/signup-intent";

export type PersistSignupIntentResult =
  | { ok: true; role: UserRole }
  | { ok: false; error: string };

/**
 * Persist the chosen signup role before Google/email authentication.
 * This is the ONLY place that may mint a new signup_intent_role cookie.
 * Completing the pre-auth 20+ gate is the proof that intent is valid.
 * Sign-in query params must never call this.
 */
export async function persistSignupIntentRole(
  role: string
): Promise<PersistSignupIntentResult> {
  if (!isValidSignupIntentRole(role)) {
    return { ok: false, error: "Choose a valid role to continue." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SIGNUP_INTENT_COOKIE,
    role,
    getSignupIntentCookieOptions(process.env.NODE_ENV === "production")
  );

  return { ok: true, role };
}
