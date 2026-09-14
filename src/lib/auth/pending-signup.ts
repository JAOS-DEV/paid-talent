/**
 * Constrained pending-signup session helpers.
 * Edge-safe: no DB, no next/headers.
 *
 * After Google/email verifies an UNKNOWN identity, Auth.js completes into a
 * JWT with signupPending=true. That JWT is encrypted with AUTH_SECRET and is
 * the cryptographic proof of the provider identity. It must not grant
 * Worker/Recruiter access.
 */

export const PENDING_SIGNUP_MAX_AGE_SECONDS = 15 * 60;
export const PENDING_SIGNUP_CONTINUE_PATH = "/auth/role-select";

export const PENDING_SIGNUP_ROUTES = [
  "/auth/role-select",
  "/auth/age-gate",
  "/auth/age-verification",
  "/auth/error",
  "/auth/verify-request",
] as const;

const APP_USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAppUserId(id: string | undefined | null): id is string {
  return typeof id === "string" && APP_USER_ID_RE.test(id);
}

export function getPendingSignupExpiry(nowMs: number = Date.now()): number {
  return nowMs + PENDING_SIGNUP_MAX_AGE_SECONDS * 1000;
}

export function isPendingSignupExpired(
  expiresAt: number | undefined | null,
  nowMs: number = Date.now()
): boolean {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return true;
  }
  return nowMs >= expiresAt;
}

export function isActivePendingSignup(input: {
  signupPending?: boolean;
  signupPendingExpiresAt?: number;
  nowMs?: number;
}): boolean {
  if (input.signupPending !== true) {
    return false;
  }
  return !isPendingSignupExpired(
    input.signupPendingExpiresAt,
    input.nowMs ?? Date.now()
  );
}

export function isPendingSignupUser(user: {
  signupPending?: boolean;
} | null | undefined): boolean {
  return user?.signupPending === true;
}

export function isPendingSignupContinuationRoute(pathname: string): boolean {
  return PENDING_SIGNUP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
