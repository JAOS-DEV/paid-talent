import type { UserRole } from "@/types/auth";
import {
  INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
  type ProfileCompleteness,
} from "@/lib/profile";

export interface HomeRedirectInput {
  isAuthenticated: boolean;
  role: UserRole | null;
  profileCompleteness: ProfileCompleteness | null;
}

export interface HomeRedirectResult {
  shouldRedirect: boolean;
  destination: string | null;
}

export function getHomeRedirectDestination(
  input: HomeRedirectInput
): HomeRedirectResult {
  if (!input.isAuthenticated || !input.role) {
    return { shouldRedirect: false, destination: null };
  }

  if (input.role === "recruiter") {
    return { shouldRedirect: true, destination: "/recruiter/dashboard" };
  }

  if (input.role === "worker") {
    const completeness = input.profileCompleteness;

    if (
      !completeness ||
      (!completeness.isComplete &&
        completeness.progress < INCOMPLETE_PROFILE_REDIRECT_THRESHOLD)
    ) {
      return { shouldRedirect: true, destination: "/worker/onboarding" };
    }

    return { shouldRedirect: true, destination: "/worker/dashboard" };
  }

  return { shouldRedirect: false, destination: null };
}
