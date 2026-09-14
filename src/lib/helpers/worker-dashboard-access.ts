import type { ProfileCompleteness } from "@/lib/profile";

export const WORKER_DASHBOARD_PATH = "/worker/dashboard";
export const WORKER_ONBOARDING_PATH = "/worker/onboarding";
export const WORKER_PROFILE_PATH = "/worker/profile";
export const ONBOARDING_FINISH_LATER_HREF = WORKER_DASHBOARD_PATH;

export interface WorkerDashboardProfileAction {
  href: string;
  label: "Complete Profile" | "Edit Profile";
  showIncompleteTips: boolean;
}

export type OnboardingLoadAction =
  | { action: "redirect-to-dashboard" }
  | { action: "resume"; stepId: string };

/**
 * Workers may use the dashboard at any completeness, including 0%.
 * Publication/search eligibility is independent of this check.
 */
export function isWorkerDashboardAccessible(
  completeness: ProfileCompleteness | null
): boolean {
  if (completeness === null) {
    return true;
  }

  return Number.isFinite(completeness.progress);
}

export function getWorkerDashboardProfileAction(
  completeness: ProfileCompleteness
): WorkerDashboardProfileAction {
  if (completeness.isComplete) {
    return {
      href: WORKER_PROFILE_PATH,
      label: "Edit Profile",
      showIncompleteTips: false,
    };
  }

  return {
    href: WORKER_ONBOARDING_PATH,
    label: "Complete Profile",
    showIncompleteTips: true,
  };
}

export function resolveOnboardingAfterProfileLoad(
  completeness: ProfileCompleteness
): OnboardingLoadAction {
  if (completeness.isComplete) {
    return { action: "redirect-to-dashboard" };
  }

  return {
    action: "resume",
    stepId: completeness.nextStep ?? "photo",
  };
}
