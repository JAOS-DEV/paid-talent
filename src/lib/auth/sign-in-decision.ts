import type { UserRole } from "@/types/auth";

export interface ExistingAuthUser {
  id: string;
  role: UserRole;
  ageVerified: boolean;
}

/**
 * Decision produced by the NextAuth `signIn` callback for Google/email providers.
 *
 * CRITICAL: Never return a redirect to `/auth/age-verification` from `signIn`.
 * That aborts OAuth/email auth before a session exists and causes a redirect loop
 * (age-verification requires auth → bounce to signin → repeat).
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
}): SignInDecision {
  const { existingUser, signupIntentRole, email } = input;

  if (!existingUser) {
    if (isValidSignupIntentRole(signupIntentRole)) {
      return { kind: "create_and_complete", role: signupIntentRole };
    }

    return {
      kind: "abort_redirect",
      url: "/auth/role-select?email=" + encodeURIComponent(email),
    };
  }

  // Always complete sign-in for existing users — including ageVerified=false.
  // Middleware redirects authenticated unverified users to /auth/age-verification.
  return {
    kind: "complete_existing",
    user: {
      id: existingUser.id,
      role: existingUser.role,
      ageVerified: existingUser.ageVerified,
    },
  };
}

/**
 * Apply a client `session.update({ ageVerified: true })` into the JWT token fields.
 */
export function applyJwtSessionUpdate(input: {
  tokenRole: UserRole | undefined;
  tokenAgeVerified: boolean | undefined;
  sessionRole?: UserRole;
  sessionAgeVerified?: boolean;
}): { role: UserRole | undefined; ageVerified: boolean | undefined } {
  return {
    role: input.sessionRole ?? input.tokenRole,
    ageVerified: input.sessionAgeVerified ?? input.tokenAgeVerified,
  };
}

/**
 * Post-DOB redirect preserves Worker/Recruiter role.
 */
export function getPostAgeVerificationRedirect(
  role: UserRole | string | undefined | null
): string {
  return role === "worker" ? "/worker/onboarding" : "/recruiter/dashboard";
}
