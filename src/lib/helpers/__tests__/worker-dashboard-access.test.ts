import { describe, it, expect } from "vitest";
import { getProfileCompleteness, type ProfileCompleteness } from "@/lib/profile";
import { isSearchableWorker } from "@/lib/verification";
import {
  getWorkerDashboardProfileAction,
  isWorkerDashboardAccessible,
  resolveOnboardingAfterProfileLoad,
  ONBOARDING_FINISH_LATER_HREF,
  WORKER_DASHBOARD_PATH,
  WORKER_ONBOARDING_PATH,
  WORKER_PROFILE_PATH,
} from "../worker-dashboard-access";
import type { WorkerProfile } from "@/lib/db/schema";

function createCompleteness(
  overrides: Partial<ProfileCompleteness> = {}
): ProfileCompleteness {
  return {
    isComplete: false,
    completedSteps: [],
    nextStep: "photo",
    progress: 0,
    ...overrides,
  };
}

function createMockProfile(
  overrides: Partial<WorkerProfile> = {}
): WorkerProfile {
  return {
    id: "test-id",
    userId: "test-user-id",
    photoKey: null,
    photoUrl: null,
    displayName: "",
    location: null,
    area: null,
    description: null,
    bio: null,
    availability: null,
    expectedPayMin: null,
    expectedPayMax: null,
    payCurrency: "USD",
    jobRoles: [],
    experience: null,
    experienceYears: null,
    languages: [],
    lineId: null,
    whatsappNumber: null,
    phoneNumber: null,
    isPublished: false,
    isVerified: false,
    verificationStatus: "unverified",
    idDocumentKey: null,
    livenessVideoKey: null,
    challengeCode: null,
    challengeIssuedAt: null,
    idDocumentSubmittedAt: null,
    verificationReviewedAt: null,
    verificationReviewedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("worker dashboard access", () => {
  describe("isWorkerDashboardAccessible", () => {
    it("allows a 0% complete worker to stay on the dashboard", () => {
      expect(isWorkerDashboardAccessible(null)).toBe(true);
      expect(
        isWorkerDashboardAccessible(createCompleteness({ progress: 0 }))
      ).toBe(true);
    });

    it("allows a worker below the historical 30% threshold to stay on the dashboard", () => {
      expect(
        isWorkerDashboardAccessible(
          createCompleteness({ isComplete: false, progress: 14 })
        )
      ).toBe(true);
      expect(
        isWorkerDashboardAccessible(
          createCompleteness({ isComplete: false, progress: 29 })
        )
      ).toBe(true);
    });

    it("allows a complete profile to stay on the dashboard", () => {
      expect(
        isWorkerDashboardAccessible(
          createCompleteness({ isComplete: true, progress: 100, nextStep: null })
        )
      ).toBe(true);
    });
  });

  describe("getWorkerDashboardProfileAction", () => {
    it("shows Complete Profile for an incomplete dashboard", () => {
      const action = getWorkerDashboardProfileAction(
        createCompleteness({ progress: 0 })
      );

      expect(action.label).toBe("Complete Profile");
      expect(action.href).toBe(WORKER_ONBOARDING_PATH);
      expect(action.showIncompleteTips).toBe(true);
    });

    it("shows Edit Profile for a complete dashboard", () => {
      const action = getWorkerDashboardProfileAction(
        createCompleteness({ isComplete: true, progress: 100, nextStep: null })
      );

      expect(action.label).toBe("Edit Profile");
      expect(action.href).toBe(WORKER_PROFILE_PATH);
      expect(action.showIncompleteTips).toBe(false);
    });
  });

  describe("Finish later", () => {
    it("navigates to the worker dashboard", () => {
      expect(ONBOARDING_FINISH_LATER_HREF).toBe(WORKER_DASHBOARD_PATH);
    });
  });

  describe("resolveOnboardingAfterProfileLoad", () => {
    it("resumes at the first incomplete required step", () => {
      const completeness = getProfileCompleteness(
        createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
          displayName: "Ada",
        })
      );

      expect(completeness.nextStep).toBe("roles");
      expect(resolveOnboardingAfterProfileLoad(completeness)).toEqual({
        action: "resume",
        stepId: "roles",
      });
    });

    it("resumes at photo when the profile is empty", () => {
      expect(
        resolveOnboardingAfterProfileLoad(getProfileCompleteness(null))
      ).toEqual({
        action: "resume",
        stepId: "photo",
      });
    });

    it("redirects a complete profile to the dashboard", () => {
      const completeness = getProfileCompleteness(
        createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
          displayName: "Ada",
          jobRoles: ["Bartender"],
          experienceYears: 3,
          languages: ["English"],
          bio: "Experienced bartender",
          location: "Bangkok",
          availability: "Full-time",
        })
      );

      expect(completeness.isComplete).toBe(true);
      expect(resolveOnboardingAfterProfileLoad(completeness)).toEqual({
        action: "redirect-to-dashboard",
      });
    });
  });

  describe("publication remains independent of dashboard access", () => {
    it("does not make an incomplete unpublished profile searchable", () => {
      const profile = createMockProfile({ isPublished: false });
      expect(isWorkerDashboardAccessible(getProfileCompleteness(profile))).toBe(
        true
      );
      expect(isSearchableWorker(profile)).toEqual({
        isSearchable: false,
        reason: "not_published",
      });
    });
  });
});
