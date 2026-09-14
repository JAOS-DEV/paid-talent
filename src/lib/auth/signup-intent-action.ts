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
 * Called when the pre-auth 20+ gate is completed so the intent survives OAuth.
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
