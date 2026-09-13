import { describe, it, expect } from "vitest";
import {
  getHomeRedirectDestination,
  type HomeRedirectInput,
} from "../home-redirect";
import {
  INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
  type ProfileCompleteness,
} from "@/lib/profile";

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

describe("home-redirect helpers", () => {
  describe("getHomeRedirectDestination", () => {
    describe("unauthenticated users", () => {
      it("should not redirect unauthenticated users", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: false,
          role: null,
          profileCompleteness: null,
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(false);
        expect(result.destination).toBeNull();
      });

      it("should not redirect when isAuthenticated is false even with role", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: false,
          role: "worker",
          profileCompleteness: null,
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(false);
        expect(result.destination).toBeNull();
      });
    });

    describe("recruiter users", () => {
      it("should redirect recruiter to recruiter dashboard", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "recruiter",
          profileCompleteness: null,
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/recruiter/dashboard");
      });

      it("should redirect recruiter regardless of profileCompleteness", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "recruiter",
          profileCompleteness: createCompleteness({ progress: 0 }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/recruiter/dashboard");
      });
    });

    describe("worker users with complete profile", () => {
      it("should redirect worker with complete profile to worker dashboard", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: true,
            progress: 100,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/worker/dashboard");
      });

      it("should redirect worker with progress at threshold to dashboard", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: false,
            progress: INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/worker/dashboard");
      });

      it("should redirect worker with progress above threshold to dashboard", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: false,
            progress: INCOMPLETE_PROFILE_REDIRECT_THRESHOLD + 10,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/worker/dashboard");
      });
    });

    describe("worker users with incomplete profile", () => {
      it("should redirect worker with no profile to onboarding", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: null,
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/worker/onboarding");
      });

      it("should redirect worker with 0% progress to onboarding", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: false,
            progress: 0,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/worker/onboarding");
      });

      it("should redirect worker with progress below threshold to onboarding", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: false,
            progress: INCOMPLETE_PROFILE_REDIRECT_THRESHOLD - 1,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(true);
        expect(result.destination).toBe("/worker/onboarding");
      });
    });

    describe("threshold boundary cases", () => {
      it("should use INCOMPLETE_PROFILE_REDIRECT_THRESHOLD of 30", () => {
        expect(INCOMPLETE_PROFILE_REDIRECT_THRESHOLD).toBe(30);
      });

      it("should redirect to onboarding at progress 29", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: false,
            progress: 29,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.destination).toBe("/worker/onboarding");
      });

      it("should redirect to dashboard at progress 30", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: "worker",
          profileCompleteness: createCompleteness({
            isComplete: false,
            progress: 30,
          }),
        };

        const result = getHomeRedirectDestination(input);

        expect(result.destination).toBe("/worker/dashboard");
      });
    });

    describe("edge cases", () => {
      it("should handle authenticated user with null role", () => {
        const input: HomeRedirectInput = {
          isAuthenticated: true,
          role: null,
          profileCompleteness: null,
        };

        const result = getHomeRedirectDestination(input);

        expect(result.shouldRedirect).toBe(false);
        expect(result.destination).toBeNull();
      });
    });
  });
});
