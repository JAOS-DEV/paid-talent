import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
  toOwnedPhotoDto,
} from "../photo-moderation";
import {
  applyPhotoPolicy,
  decidePhotoSubmission,
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
      expect(decidePhotoSubmission(safeAnalysis).status).toBe("pending");
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
        "No nudes. We'll review each photo before it goes live."
      );
    });

    it("should provide correct pending copy", () => {
      expect(PHOTO_POLICY_COPY.pending).toBe(
        "This photo will appear on your profile after it is approved."
      );
    });

    it("should provide correct rejected copy", () => {
      expect(PHOTO_POLICY_COPY.rejected).toBe(
        "This photo didn't meet our guidelines. Try a clear, face-forward shot without nudity."
      );
    });
  });

  describe("moderation workflow", () => {
    it("keeps explicit nudity pending for admin review in manual mode", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["explicit_nudity"],
        confidence: 0.95,
      };
      const advisory = applyPhotoPolicy(analysis);
      const decision = decidePhotoSubmission(analysis);

      expect(advisory.action).toBe("reject");
      expect(decision.action).toBe("quarantine");
      expect(decision.requiresReview).toBe(true);
      expect(decision.status).toBe("pending");
    });

    it("should quarantine lingerie for admin review", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["lingerie_swimwear"],
        confidence: 0.9,
      };
      const decision = decidePhotoSubmission(analysis);

      expect(decision.action).toBe("quarantine");
      expect(decision.requiresReview).toBe(true);
    });

    it("should quarantine ambiguous content for admin review", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["unknown"],
        confidence: 0.6,
      };
      const decision = decidePhotoSubmission(analysis);

      expect(decision.action).toBe("quarantine");
      expect(decision.requiresReview).toBe(true);
    });

    it("does not auto-approve safe content in current manual mode", () => {
      const analysis: PhotoAnalysisResult = {
        categories: ["safe"],
        confidence: 0.92,
      };
      const decision = decidePhotoSubmission(analysis);

      expect(decision.action).toBe("quarantine");
      expect(decision.status).toBe("pending");
      expect(decision.requiresReview).toBe(true);
    });
  });

  describe("previous photo visibility during pending", () => {
    it("tells the worker the photo is not live until approved", () => {
      expect(PHOTO_POLICY_COPY.pending).toContain("after it is approved");
    });
  });

  describe("provider scenarios", () => {
    it("should handle safe scenario correctly", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("safe");

      const result = await provider.analyzeImage("https://example.com/image.jpg");
      const decision = decidePhotoSubmission(result);

      expect(decision.action).toBe("quarantine");
      expect(decision.status).toBe("pending");
    });

    it("should handle explicit scenario correctly", async () => {
      const provider = new StubPhotoModerationProvider();
      provider.setScenario("explicit");

      const result = await provider.analyzeImage("https://example.com/image.jpg");
      const decision = decidePhotoSubmission(result);

      expect(decision.action).toBe("quarantine");
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

  describe("owned photo DTO", () => {
    it("never exposes stagingKey and hides analyzer reasons until admin rejection", () => {
      const pending = toOwnedPhotoDto({
        id: "p1",
        userId: "u1",
        workerProfileId: "w1",
        stagingKey: "profile-photo-staging/u1/a.jpg",
        photoKey: null,
        photoUrl: null,
        moderationStatus: "pending",
        moderationReason: "Content meets guidelines",
        moderationConfidence: 92,
        moderationCategories: ["safe"],
        moderationReviewedAt: null,
        moderationReviewedBy: null,
        displayOrder: 0,
        isCurrentApproved: false,
        createdAt: new Date("2026-09-15T00:00:00.000Z"),
        updatedAt: new Date("2026-09-15T00:00:00.000Z"),
      });

      expect(pending).not.toHaveProperty("stagingKey");
      expect(pending.photoUrl).toBeNull();
      expect(pending.moderationReason).toBeNull();
      expect(pending.moderationStatus).toBe("pending");
    });

    it("shows the admin rejection reason after review", () => {
      const rejected = toOwnedPhotoDto({
        id: "p2",
        userId: "u1",
        workerProfileId: "w1",
        stagingKey: null,
        photoKey: null,
        photoUrl: null,
        moderationStatus: "rejected",
        moderationReason: "Please upload a clear face-forward photo.",
        moderationConfidence: 10,
        moderationCategories: ["explicit_nudity"],
        moderationReviewedAt: new Date("2026-09-15T00:00:00.000Z"),
        moderationReviewedBy: "admin@example.com",
        displayOrder: 1,
        isCurrentApproved: false,
        createdAt: new Date("2026-09-15T00:00:00.000Z"),
        updatedAt: new Date("2026-09-15T00:00:00.000Z"),
      });

      expect(rejected.moderationReason).toBe(
        "Please upload a clear face-forward photo."
      );
      expect(rejected.photoUrl).toBeNull();
    });
  });
});
