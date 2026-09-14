/**
 * Pure middleware gate for auth + age-verification redirects.
 * Extracted so redirect-loop regressions can be unit-tested without NextRequest.
 */

import {
  PENDING_SIGNUP_CONTINUE_PATH,
  isPendingSignupContinuationRoute,
} from "@/lib/auth/pending-signup";

export const AUTH_PUBLIC_ROUTES = [
  "/",
  "/auth/signin",
  "/auth/role-select",
  "/auth/age-gate",
  "/auth/verify-request",
  "/auth/error",
  "/auth/account-restricted",
  "/api/auth",
] as const;

export const AGE_VERIFICATION_PATH = "/auth/age-verification";

export type MiddlewareGateResult =
  | { action: "allow" }
  | {
      action: "redirect";
      destination: string;
      setCallbackUrl?: boolean;
    }
  | { action: "json"; status: number; error: string };

export function isPublicAuthRoute(pathname: string): boolean {
  return AUTH_PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Resolve whether the request may proceed, must redirect, or returns JSON.
 * Role-based Worker/Recruiter routing is handled separately after this gate.
 */
export function resolveMiddlewareGate(input: {
  pathname: string;
  hasSession: boolean;
  ageVerified: boolean;
  isApiRoute: boolean;
  isAuthApiRoute: boolean;
  signupPending?: boolean;
  hasSignupIntent?: boolean;
}): MiddlewareGateResult {
  const {
    pathname,
    hasSession,
    ageVerified,
    isApiRoute,
    isAuthApiRoute,
    signupPending = false,
    hasSignupIntent = false,
  } = input;

  // NextAuth routes must always pass (includes /api/auth/verify-age)
  if (isAuthApiRoute) {
    return { action: "allow" };
  }

  if (signupPending) {
    if (pathname === AGE_VERIFICATION_PATH && !hasSignupIntent) {
      return {
        action: "redirect",
        destination: PENDING_SIGNUP_CONTINUE_PATH,
      };
    }

    if (isPendingSignupContinuationRoute(pathname)) {
      return { action: "allow" };
    }

    if (isApiRoute) {
      return {
        action: "json",
        status: 403,
        error: "Finish creating your account",
      };
    }

    return {
      action: "redirect",
      destination: PENDING_SIGNUP_CONTINUE_PATH,
    };
  }

  if (!hasSession) {
    if (isPublicAuthRoute(pathname)) {
      return { action: "allow" };
    }

    // Post-auth DOB page requires a session — anonymous users go to signin
    if (isApiRoute) {
      return { action: "json", status: 401, error: "Unauthorized" };
    }

    return {
      action: "redirect",
      destination: "/auth/signin",
      setCallbackUrl: true,
    };
  }

  // Authenticated but not age-verified
  if (!ageVerified) {
    if (pathname === AGE_VERIFICATION_PATH) {
      return { action: "allow" };
    }

    if (isApiRoute) {
      return {
        action: "json",
        status: 403,
        error: "Age verification required",
      };
    }

    return {
      action: "redirect",
      destination: AGE_VERIFICATION_PATH,
    };
  }

  // Authenticated + age-verified: allow through (role checks follow in middleware)
  return { action: "allow" };
}
