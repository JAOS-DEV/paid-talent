import { describe, it, expect } from "vitest";
import {
  getProfileCompleteness,
  ONBOARDING_STEPS,
  INCOMPLETE_PROFILE_REDIRECT_THRESHOLD,
} from "../index";
import type { WorkerProfile } from "@/lib/db/schema";

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

describe("profile completeness", () => {
  describe("INCOMPLETE_PROFILE_REDIRECT_THRESHOLD", () => {
    it("should be 30", () => {
      expect(INCOMPLETE_PROFILE_REDIRECT_THRESHOLD).toBe(30);
    });
  });

  describe("ONBOARDING_STEPS", () => {
    it("should have 8 steps total", () => {
      expect(ONBOARDING_STEPS).toHaveLength(8);
    });

    it("should have 7 required steps", () => {
      const requiredSteps = ONBOARDING_STEPS.filter((s) => s.isRequired);
      expect(requiredSteps).toHaveLength(7);
    });

    it("should have contact step as optional", () => {
      const contactStep = ONBOARDING_STEPS.find((s) => s.id === "contact");
      expect(contactStep?.isRequired).toBe(false);
    });
  });

  describe("getProfileCompleteness", () => {
    describe("with null profile", () => {
      it("should return incomplete with 0 progress", () => {
        const result = getProfileCompleteness(null);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(0);
        expect(result.completedSteps).toEqual([]);
        expect(result.nextStep).toBe("photo");
      });
    });

    describe("with empty profile", () => {
      it("should return incomplete with 0 progress", () => {
        const profile = createMockProfile();
        const result = getProfileCompleteness(profile);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(0);
        expect(result.completedSteps).toEqual([]);
      });
    });

    describe("location step - requires BOTH location AND availability", () => {
      it("should NOT mark location step complete with only location set", () => {
        const profile = createMockProfile({
          location: "Bangkok, Thailand",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("location");
      });

      it("should NOT mark location step complete with only availability set", () => {
        const profile = createMockProfile({
          availability: "Full-time",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("location");
      });

      it("should NOT mark location step complete with only expectedPayMin set", () => {
        const profile = createMockProfile({
          expectedPayMin: 500,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("location");
      });

      it("should NOT mark location step complete with expectedPayMin + expectedPayMax but no location/availability", () => {
        const profile = createMockProfile({
          expectedPayMin: 500,
          expectedPayMax: 1000,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("location");
      });

      it("should mark location step complete with BOTH location AND availability", () => {
        const profile = createMockProfile({
          location: "Bangkok, Thailand",
          availability: "Full-time",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("location");
      });

      it("should mark location step complete with location + availability (pay optional)", () => {
        const profile = createMockProfile({
          location: "Bangkok, Thailand",
          availability: "Part-time",
          expectedPayMin: null,
          expectedPayMax: null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("location");
      });

      it("should mark location step complete with location + availability + pay", () => {
        const profile = createMockProfile({
          location: "Bangkok, Thailand",
          availability: "Full-time",
          expectedPayMin: 500,
          expectedPayMax: 1000,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("location");
      });
    });

    describe("experience step - requires EITHER years OR description", () => {
      it("should NOT mark experience step complete with neither years nor description", () => {
        const profile = createMockProfile({
          experienceYears: null,
          experience: null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("experience");
      });

      it("should NOT mark experience step complete with empty experience string", () => {
        const profile = createMockProfile({
          experienceYears: null,
          experience: "",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("experience");
      });

      it("should NOT mark experience step complete with whitespace-only experience", () => {
        const profile = createMockProfile({
          experienceYears: null,
          experience: "   ",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("experience");
      });

      it("should mark experience step complete with only experienceYears", () => {
        const profile = createMockProfile({
          experienceYears: 3,
          experience: null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("experience");
      });

      it("should mark experience step complete with only experience description", () => {
        const profile = createMockProfile({
          experienceYears: null,
          experience: "Worked at various restaurants for 5 years",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("experience");
      });

      it("should mark experience step complete with BOTH years and description", () => {
        const profile = createMockProfile({
          experienceYears: 5,
          experience: "Senior bartender at multiple venues",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("experience");
      });

      it("should mark experience step complete with 0 years (falsy but valid)", () => {
        const profile = createMockProfile({
          experienceYears: 0,
          experience: null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("experience");
      });
    });

    describe("contact step - optional / skippable", () => {
      it("should NOT require contact for profile completion", () => {
        const profile = createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
          displayName: "John Doe",
          jobRoles: ["Bartender"],
          experienceYears: 3,
          languages: ["English"],
          bio: "Experienced bartender",
          location: "Bangkok",
          availability: "Full-time",
          lineId: null,
          whatsappNumber: null,
          phoneNumber: null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.isComplete).toBe(true);
        expect(result.progress).toBe(100);
      });

      it("should mark contact step complete if any contact method provided", () => {
        const profile = createMockProfile({
          lineId: "mylineid",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("contact");
      });

      it("should mark contact step complete with whatsapp only", () => {
        const profile = createMockProfile({
          whatsappNumber: "+1234567890",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("contact");
      });

      it("should mark contact step complete with phone only", () => {
        const profile = createMockProfile({
          phoneNumber: "+1234567890",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("contact");
      });

      it("should NOT mark contact step complete with no contact methods", () => {
        const profile = createMockProfile({
          lineId: null,
          whatsappNumber: null,
          phoneNumber: null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("contact");
      });
    });

    describe("single-field steps", () => {
      it("should mark photo step complete when photoUrl is set", () => {
        const profile = createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("photo");
      });

      it("should NOT mark photo step complete with empty photoUrl", () => {
        const profile = createMockProfile({
          photoUrl: "",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("photo");
      });

      it("should mark name step complete when displayName is set", () => {
        const profile = createMockProfile({
          displayName: "John Doe",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("name");
      });

      it("should NOT mark name step complete with empty displayName", () => {
        const profile = createMockProfile({
          displayName: "",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("name");
      });

      it("should mark roles step complete when jobRoles is non-empty", () => {
        const profile = createMockProfile({
          jobRoles: ["Bartender", "Server"],
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("roles");
      });

      it("should NOT mark roles step complete with empty jobRoles array", () => {
        const profile = createMockProfile({
          jobRoles: [],
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("roles");
      });

      it("should mark languages step complete when languages is non-empty", () => {
        const profile = createMockProfile({
          languages: ["English", "Thai"],
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("languages");
      });

      it("should NOT mark languages step complete with empty languages array", () => {
        const profile = createMockProfile({
          languages: [],
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("languages");
      });

      it("should mark bio step complete when bio is set", () => {
        const profile = createMockProfile({
          bio: "I am an experienced hospitality worker",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).toContain("bio");
      });

      it("should NOT mark bio step complete with empty bio", () => {
        const profile = createMockProfile({
          bio: "",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("bio");
      });

      it("should NOT mark bio step complete with whitespace-only bio", () => {
        const profile = createMockProfile({
          bio: "   ",
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("bio");
      });
    });

    describe("full profile completion", () => {
      it("should return 100% progress for fully completed profile", () => {
        const profile = createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
          displayName: "John Doe",
          jobRoles: ["Bartender"],
          experienceYears: 5,
          languages: ["English", "Thai"],
          bio: "Experienced bartender with 5 years in the industry",
          location: "Bangkok, Thailand",
          availability: "Full-time",
        });
        const result = getProfileCompleteness(profile);
        expect(result.isComplete).toBe(true);
        expect(result.progress).toBe(100);
        expect(result.nextStep).toBeNull();
      });

      it("should return correct progress percentage for partial completion", () => {
        const profile = createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
          displayName: "John Doe",
          jobRoles: ["Bartender"],
        });
        const result = getProfileCompleteness(profile);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(43);
      });

      it("should identify the correct next step for partial completion", () => {
        const profile = createMockProfile({
          photoUrl: "https://example.com/photo.jpg",
          displayName: "John Doe",
          jobRoles: ["Bartender"],
        });
        const result = getProfileCompleteness(profile);
        expect(result.nextStep).toBe("experience");
      });
    });

    describe("edge cases", () => {
      it("should handle null values correctly", () => {
        const profile = createMockProfile({
          photoUrl: null,
          displayName: "",
          jobRoles: null as unknown as string[],
        });
        const result = getProfileCompleteness(profile);
        expect(result.isComplete).toBe(false);
        expect(result.progress).toBe(0);
      });

      it("should handle undefined values correctly", () => {
        const profile = createMockProfile({
          photoUrl: undefined as unknown as string | null,
        });
        const result = getProfileCompleteness(profile);
        expect(result.completedSteps).not.toContain("photo");
      });
    });
  });
});
