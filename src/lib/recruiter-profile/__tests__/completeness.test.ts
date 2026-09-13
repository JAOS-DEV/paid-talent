import { describe, it, expect } from "vitest";
import {
  getRecruiterProfileCompleteness,
  isRecruiterProfileComplete,
  validateBlurbLength,
  validateOpeningNotesLength,
  RECRUITER_ONBOARDING_STEPS,
  BLURB_MAX_LENGTH,
  OPENING_NOTES_MAX_LENGTH,
} from "../index";
import type { RecruiterProfile } from "@/lib/db/schema";

function createMockRecruiterProfile(
  overrides: Partial<RecruiterProfile> = {}
): RecruiterProfile {
  return {
    id: "test-id",
    userId: "test-user-id",
    organizationName: null,
    organizationType: null,
    website: null,
    description: null,
    location: null,
    contactEmail: null,
    contactPhone: null,
    logoKey: null,
    logoUrl: null,
    area: null,
    subArea: null,
    blurb: null,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("recruiter profile completeness", () => {
  describe("constants", () => {
    it("should have correct blurb max length", () => {
      expect(BLURB_MAX_LENGTH).toBe(240);
    });

    it("should have correct opening notes max length", () => {
      expect(OPENING_NOTES_MAX_LENGTH).toBe(500);
    });
  });

  describe("RECRUITER_ONBOARDING_STEPS", () => {
    it("should have 5 steps total", () => {
      expect(RECRUITER_ONBOARDING_STEPS).toHaveLength(5);
    });

    it("should have 3 required steps", () => {
      const requiredSteps = RECRUITER_ONBOARDING_STEPS.filter(
        (s) => s.isRequired
      );
      expect(requiredSteps).toHaveLength(3);
    });

    it("should have logo step as optional", () => {
      const logoStep = RECRUITER_ONBOARDING_STEPS.find((s) => s.id === "logo");
      expect(logoStep?.isRequired).toBe(false);
    });

    it("should have contact step as optional", () => {
      const contactStep = RECRUITER_ONBOARDING_STEPS.find(
        (s) => s.id === "contact"
      );
      expect(contactStep?.isRequired).toBe(false);
    });

    it("should have venue, area, and blurb as required", () => {
      const requiredIds = RECRUITER_ONBOARDING_STEPS.filter(
        (s) => s.isRequired
      ).map((s) => s.id);
      expect(requiredIds).toContain("venue");
      expect(requiredIds).toContain("area");
      expect(requiredIds).toContain("blurb");
    });
  });

  describe("getRecruiterProfileCompleteness", () => {
    describe("with null profile", () => {
      it("should return incomplete with 0 progress", () => {
        const result = getRecruiterProfileCompleteness(null);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(0);
        expect(result.completedSteps).toEqual([]);
        expect(result.nextStep).toBe("venue");
      });
    });

    describe("with empty profile", () => {
      it("should return incomplete with 0 progress", () => {
        const profile = createMockRecruiterProfile();
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(0);
        expect(result.completedSteps).toEqual([]);
      });
    });

    describe("required fields", () => {
      it("should mark venue step complete when organizationName is set", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "Cool Bar",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).toContain("venue");
      });

      it("should NOT mark venue step complete with empty organizationName", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("venue");
      });

      it("should NOT mark venue step complete with whitespace-only organizationName", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "   ",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("venue");
      });

      it("should mark area step complete when area is set", () => {
        const profile = createMockRecruiterProfile({
          area: "Sukhumvit",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).toContain("area");
      });

      it("should NOT mark area step complete with empty area", () => {
        const profile = createMockRecruiterProfile({
          area: "",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("area");
      });

      it("should mark blurb step complete when blurb is set", () => {
        const profile = createMockRecruiterProfile({
          blurb: "We are a premium rooftop bar in Bangkok.",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).toContain("blurb");
      });

      it("should NOT mark blurb step complete with empty blurb", () => {
        const profile = createMockRecruiterProfile({
          blurb: "",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("blurb");
      });
    });

    describe("optional fields", () => {
      it("should NOT require logo for profile completion", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "Cool Bar",
          area: "Sukhumvit",
          blurb: "Premium rooftop bar with amazing views.",
          logoUrl: null,
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.isComplete).toBe(true);
        expect(result.progress).toBe(100);
      });

      it("should mark logo step complete if logoUrl provided", () => {
        const profile = createMockRecruiterProfile({
          logoUrl: "https://example.com/logo.png",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).toContain("logo");
      });

      it("should mark contact step complete if any contact method provided", () => {
        const profile = createMockRecruiterProfile({
          contactEmail: "hr@coolbar.com",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).toContain("contact");
      });

      it("should mark contact step complete with phone only", () => {
        const profile = createMockRecruiterProfile({
          contactPhone: "+66812345678",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).toContain("contact");
      });

      it("should NOT mark contact step complete with no contact methods", () => {
        const profile = createMockRecruiterProfile({
          contactEmail: null,
          contactPhone: null,
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("contact");
      });
    });

    describe("full profile completion", () => {
      it("should return 100% progress for fully completed profile", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "Luxury Rooftop Bar",
          area: "Sukhumvit",
          blurb: "Premium rooftop bar with panoramic city views.",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.isComplete).toBe(true);
        expect(result.progress).toBe(100);
        expect(result.nextStep).toBeNull();
      });

      it("should return correct progress percentage for partial completion", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "Cool Bar",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(33);
      });

      it("should identify the correct next step for partial completion", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "Cool Bar",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.nextStep).toBe("area");
      });

      it("should report 67% with venue and area completed", () => {
        const profile = createMockRecruiterProfile({
          organizationName: "Cool Bar",
          area: "Thonglor",
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.progress).toBe(67);
        expect(result.nextStep).toBe("blurb");
      });
    });

    describe("edge cases", () => {
      it("should handle null values correctly", () => {
        const profile = createMockRecruiterProfile({
          organizationName: null,
          area: null,
          blurb: null,
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(0);
      });

      it("should handle undefined values correctly", () => {
        const profile = createMockRecruiterProfile({
          organizationName: undefined as unknown as string | null,
        });
        const result = getRecruiterProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("venue");
      });
    });
  });

  describe("isRecruiterProfileComplete", () => {
    it("should return false for null profile", () => {
      expect(isRecruiterProfileComplete(null)).toBe(false);
    });

    it("should return false for incomplete profile", () => {
      const profile = createMockRecruiterProfile({
        organizationName: "Cool Bar",
      });
      expect(isRecruiterProfileComplete(profile)).toBe(false);
    });

    it("should return true for complete profile", () => {
      const profile = createMockRecruiterProfile({
        organizationName: "Cool Bar",
        area: "Sukhumvit",
        blurb: "Great venue for nightlife.",
      });
      expect(isRecruiterProfileComplete(profile)).toBe(true);
    });
  });

  describe("validateBlurbLength", () => {
    it("should return true for blurb within limit", () => {
      const blurb = "A".repeat(BLURB_MAX_LENGTH);
      expect(validateBlurbLength(blurb)).toBe(true);
    });

    it("should return false for blurb exceeding limit", () => {
      const blurb = "A".repeat(BLURB_MAX_LENGTH + 1);
      expect(validateBlurbLength(blurb)).toBe(false);
    });

    it("should return true for empty blurb", () => {
      expect(validateBlurbLength("")).toBe(true);
    });
  });

  describe("validateOpeningNotesLength", () => {
    it("should return true for notes within limit", () => {
      const notes = "A".repeat(OPENING_NOTES_MAX_LENGTH);
      expect(validateOpeningNotesLength(notes)).toBe(true);
    });

    it("should return false for notes exceeding limit", () => {
      const notes = "A".repeat(OPENING_NOTES_MAX_LENGTH + 1);
      expect(validateOpeningNotesLength(notes)).toBe(false);
    });

    it("should return true for empty notes", () => {
      expect(validateOpeningNotesLength("")).toBe(true);
    });
  });
});
