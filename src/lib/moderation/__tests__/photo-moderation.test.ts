import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
} from "../photo-moderation";
import {
  applyPhotoPolicy,
  checkPhotoLimits,
  type PhotoAnalysisResult,
} from "../photo-policy";
import {
  StubPhotoModerationProvider,
  setPhotoModerationProvider,
} from "../photo-provider";

describe("photo-moderation integration", () => {
  beforeEach(() => {
    setPhotoModerationProvider(new StubPhotoModerationProvider());
  });

  describe("recruiter visibility rules", () => {
    it("should only show approved photos to recruiters", () => {
      const safeAnalysis: PhotoAnalysisResult = {
        categories: ["safe"],
        confidence: 0.95,
      };
      const decision = applyPhotoPolicy(safeAnalysis);

      expect(decision.status).toBe("approved");
    });

    it("should keep pending photos hidden from recruiters", () => {
      const lingerieAnalysis: PhotoAnalysisResult = {
        categories: ["lingerie_swimwear"],
        confidence: 0.9,
      };
      const decision = applyPhotoPolicy(lingerieAnalysis);

      expect(decision.status).toBe("pending");
    });

    it("should not show rejected photos", () => {
      const explicitAnalysis: PhotoAnalysisResult = {
        categories: ["explicit_nudity"],
        confidence: 0.98,
      };
      const decision = applyPhotoPolicy(explicitAnalysis);

      expect(decision.status).toBe("rejected");
    });
  });

  describe("photo limit enforcement", () => {
    it("should enforce max 5 profile photos", () => {
      const result = checkPhotoLimits(5, 0);

      expect(result.canUpload).toBe(false);
      expect(MAX_PROFILE_PHOTOS).toBe(5);
    });

    it("should enforce max 1 pending primary photo at a time", () => {
      const result = checkPhotoLimits(2, 1);

      expect(result.canUpload).toBe(false);
      expect(MAX_PENDING_PHOTOS).toBe(1);
    });

    it("allows multiple pending gallery photos under the five-slot cap", () => {
      const result = checkPhotoLimits(1, 3, {
        purpose: "gallery",
        isVerified: true,
      });

      expect(result.canUpload).toBe(true);
    });

    it("should allow upload when under both limits", () => {
      const result = checkPhotoLimits(4, 0);

      expect(result.canUpload).toBe(true);
    });

    it("does not let unverified workers use gallery purpose", () => {
      const result = checkPhotoLimits(1, 0, {
        purpose: "gallery",
        isVerified: false,
      });
      expect(result.canUpload).toBe(false);
    });
  });

  describe("policy copy verification", () => {
    it("should provide correct helper copy", () => {
      expect(PHOTO_POLICY_COPY.helper).toBe(
        "Add a clear photo so venues recognise you. Face visible preferred."
      );
    });

    it("should provide correct rules copy", () => {
      expect(PHOTO_POLICY_COPY.rules).toBe(
        "No nudes. Lingerie OK — we'll review before it goes live."
      );
    });

    it("should provide correct pending copy", () => {
      expect(PHOTO_POLICY_COPY.pending).toBe(
        "Photo under review — your profile stays visible with your previous photo until approved."
      );
    });

    it("should provide correct rejected copy", () => {
      expect(PHOTO_POLICY_COPY.rejected).toBe(
        "This photo didn't meet our guidelines. Try a clear, face-forward shot without nudity."
      );
    });
  });

  describe("moderation workflow", () => {
    it("should auto-reject explicit nudity without admin review", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["explicit_nudity"],
        confidence: 0.95,
      };
      const decision = applyPhotoPolicy(analysis);

      expect(decision.action).toBe("reject");
      expect(decision.requiresReview).toBe(false);
    });

    it("should quarantine lingerie for admin review", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["lingerie_swimwear"],
        confidence: 0.9,
      };
      const decision = applyPhotoPolicy(analysis);

      expect(decision.action).toBe("quarantine");
      expect(decision.requiresReview).toBe(true);
    });

    it("should quarantine ambiguous content for admin review", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["unknown"],
        confidence: 0.6,
      };
      const decision = applyPhotoPolicy(analysis);

      expect(decision.action).toBe("quarantine");
      expect(decision.requiresReview).toBe(true);
    });

    it("should auto-approve safe content", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["safe"],
        confidence: 0.92,
      };
      const decision = applyPhotoPolicy(analysis);

      expect(decision.action).toBe("approve");
      expect(decision.requiresReview).toBe(false);
    });
  });

  describe("previous photo visibility during pending", () => {
    it("should indicate pending status keeps previous photo visible", () => {
      expect(PHOTO_POLICY_COPY.pending).toContain("previous photo");
    });
  });

  describe("provider scenarios", () => {
    it("should handle safe scenario correctly", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("safe");

      const result = await provider.analyzeImage("https://example.com/image.jpg");
      const decision = applyPhotoPolicy(result);

      expect(decision.action).toBe("approve");
    });

    it("should handle explicit scenario correctly", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("explicit");

      const result = await provider.analyzeImage("https://example.com/image.jpg");
      const decision = applyPhotoPolicy(result);

      expect(decision.action).toBe("reject");
    });

    it("should handle lingerie scenario correctly", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("lingerie");

      const result = await provider.analyzeImage("https://example.com/image.jpg");
      const decision = applyPhotoPolicy(result);

      expect(decision.action).toBe("quarantine");
    });

    it("should handle ambiguous scenario correctly", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("ambiguous");

      const result = await provider.analyzeImage("https://example.com/image.jpg");
      const decision = applyPhotoPolicy(result);

      expect(decision.action).toBe("quarantine");
    });
  });
});
