import type { UserRole } from "@/types/auth";
import {
  buildAccountRestrictedPath,
  resolveAccountRestriction,
  type AccountStatus,
} from "@/lib/auth/account-restriction";

export interface ExistingAuthUser {
  id: string;
  role: UserRole;
  ageVerified: boolean;
  accountStatus?: AccountStatus | null;
}

/**
 * Decision produced by the NextAuth `signIn` callback for Google/email providers.
 *
 * CRITICAL: Never return a redirect to `/auth/age-verification` from `signIn`.
 * That aborts OAuth/email auth before a session exists and causes a redirect loop
 * (age-verification requires auth → bounce to signin → repeat).
 *
 * Unknown identities must complete OAuth into a constrained pending JWT rather
 * than aborting. Returning a URL from `signIn` discards the provider proof and
 * forces a second Google login.
 */
export type SignInDecision =
  | {
      kind: "complete_existing";
      user: ExistingAuthUser;
    }
  | {
      kind: "create_and_complete";
      role: UserRole;
    }
  | {
      kind: "complete_pending_signup";
    }
  | {
      kind: "abort_redirect";
      url: string;
    };

export function isValidSignupIntentRole(
  role: string | undefined
): role is UserRole {
  return role === "worker" || role === "recruiter";
}

/**
 * Pure auth decision for Google OAuth and Email magic-link sign-in.
 * Callers perform DB creates when `kind === "create_and_complete"`.
 */
export function resolveProviderSignInDecision(input: {
  existingUser: ExistingAuthUser | null;
  signupIntentRole: string | undefined;
  email: string;
  hasActiveBan?: boolean;
}): SignInDecision {
  const { existingUser, signupIntentRole, email, hasActiveBan = false } = input;

  const restriction = resolveAccountRestriction({
    hasActiveBan,
    accountStatus: existingUser?.accountStatus,
  });
  if (restriction) {
    return {
      kind: "abort_redirect",
      url: buildAccountRestrictedPath(restriction),
    };
  }

  if (!existingUser) {
    if (isValidSignupIntentRole(signupIntentRole)) {
      return { kind: "create_and_complete", role: signupIntentRole };
    }

    if (!email) {
      return { kind: "abort_redirect", url: "/auth/error" };
    }

    return { kind: "complete_pending_signup" };
  }

  // Always complete sign-in for existing users — including ageVerified=false.
  // Middleware redirects authenticated unverified users to /auth/age-verification.
  return {
    kind: "complete_existing",
    user: {
      id: existingUser.id,
      role: existingUser.role,
      ageVerified: existingUser.ageVerified,
      ...(existingUser.accountStatus
        ? { accountStatus: existingUser.accountStatus }
        : {}),
    },
  };
}

export { applyJwtSessionUpdate } from "@/lib/auth/jwt-session";

/**
 * Post-DOB redirect preserves Worker/Recruiter role.
 */
export function getPostAgeVerificationRedirect(
  role: UserRole | string | undefined | null
): string {
  return role === "worker" ? "/worker/onboarding" : "/recruiter/dashboard";
}
