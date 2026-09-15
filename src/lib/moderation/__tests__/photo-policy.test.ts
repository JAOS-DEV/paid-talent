import { describe, it, expect } from "vitest";
import {
  applyPhotoPolicy,
  checkPhotoLimits,
  MAX_PROFILE_PHOTOS,
  MAX_PENDING_PHOTOS,
  PHOTO_POLICY_COPY,
  type PhotoAnalysisResult,
} from "../photo-policy";

describe("photo-policy", () => {
  describe("applyPhotoPolicy", () => {
    describe("explicit nudity rejection", () => {
      it("should reject explicit nudity with high confidence", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["explicit_nudity"],
          confidence: 0.95,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
        expect(decision.requiresReview).toBe(false);
        expect(decision.reason).toContain("nudity");
      });

      it("should reject explicit nudity even with low confidence", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["explicit_nudity"],
          confidence: 0.5,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
      });
    });

    describe("violence/hate/drugs rejection", () => {
      it("should reject violence content", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["violence"],
          confidence: 0.9,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
        expect(decision.reason).toContain("community guidelines");
      });

      it("should reject hate symbols", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["hate_symbols"],
          confidence: 0.85,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
      });

      it("should reject drugs content", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["drugs"],
          confidence: 0.88,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
      });
    });

    describe("lingerie/swimwear quarantine", () => {
      it("should quarantine lingerie content for manual review", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["lingerie_swimwear"],
          confidence: 0.85,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("quarantine");
        expect(decision.status).toBe("pending");
        expect(decision.requiresReview).toBe(true);
        expect(decision.reason).toContain("manual review");
      });

      it("should quarantine suggestive content for manual review", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["suggestive"],
          confidence: 0.9,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("quarantine");
        expect(decision.status).toBe("pending");
        expect(decision.requiresReview).toBe(true);
      });

      it("should quarantine combined lingerie and suggestive content", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["lingerie_swimwear", "suggestive"],
          confidence: 0.92,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("quarantine");
        expect(decision.status).toBe("pending");
        expect(decision.requiresReview).toBe(true);
      });
    });

    describe("ambiguous content quarantine", () => {
      it("should quarantine low confidence results", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["safe"],
          confidence: 0.5,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("quarantine");
        expect(decision.status).toBe("pending");
        expect(decision.requiresReview).toBe(true);
        expect(decision.reason).toContain("Low confidence");
      });

      it("should quarantine unknown content without safe flag", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["unknown"],
          confidence: 0.8,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("quarantine");
        expect(decision.status).toBe("pending");
        expect(decision.requiresReview).toBe(true);
        expect(decision.reason).toContain("Ambiguous");
      });

      it("should approve unknown content if also marked safe", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["unknown", "safe"],
          confidence: 0.85,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("approve");
        expect(decision.status).toBe("approved");
      });
    });

    describe("safe content approval", () => {
      it("should approve safe content with high confidence", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["safe"],
          confidence: 0.92,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("approve");
        expect(decision.status).toBe("approved");
        expect(decision.requiresReview).toBe(false);
        expect(decision.reason).toContain("meets guidelines");
      });

      it("should approve empty categories with high confidence", () => {
        const analysis: PhotoAnalysisResult = {
          categories: [],
          confidence: 0.9,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("approve");
        expect(decision.status).toBe("approved");
      });
    });

    describe("priority rules", () => {
      it("should reject nudity even if also marked safe", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["explicit_nudity", "safe"],
          confidence: 0.95,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
      });

      it("should reject violence over lingerie quarantine", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["violence", "lingerie_swimwear"],
          confidence: 0.9,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("reject");
        expect(decision.status).toBe("rejected");
      });

      it("should quarantine lingerie over approval", () => {
        const analysis: PhotoAnalysisResult = {
          categories: ["lingerie_swimwear", "safe"],
          confidence: 0.95,
        };
        const decision = applyPhotoPolicy(analysis);

        expect(decision.action).toBe("quarantine");
        expect(decision.status).toBe("pending");
      });
    });
  });

  describe("checkPhotoLimits", () => {
    it("should allow upload when no photos exist", () => {
      const result = checkPhotoLimits(0, 0);

      expect(result.canUpload).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.currentApprovedCount).toBe(0);
      expect(result.currentPendingCount).toBe(0);
    });

    it("should allow upload when under limits", () => {
      const result = checkPhotoLimits(3, 0);

      expect(result.canUpload).toBe(true);
      expect(result.currentApprovedCount).toBe(3);
      expect(result.currentPendingCount).toBe(0);
    });

    it("should block upload when pending limit reached", () => {
      const result = checkPhotoLimits(2, MAX_PENDING_PHOTOS);

      expect(result.canUpload).toBe(false);
      expect(result.reason).toBe(PHOTO_POLICY_COPY.pending);
      expect(result.currentPendingCount).toBe(MAX_PENDING_PHOTOS);
    });

    it("should block upload when max photos reached", () => {
      const result = checkPhotoLimits(MAX_PROFILE_PHOTOS, 0);

      expect(result.canUpload).toBe(false);
      expect(result.reason).toContain(`${MAX_PROFILE_PHOTOS}`);
      expect(result.currentApprovedCount).toBe(MAX_PROFILE_PHOTOS);
    });

    it("should prioritize pending limit over max photos", () => {
      const result = checkPhotoLimits(4, MAX_PENDING_PHOTOS);

      expect(result.canUpload).toBe(false);
      expect(result.reason).toBe(PHOTO_POLICY_COPY.pending);
    });

    it("blocks gallery uploads until the worker is verified", () => {
      const result = checkPhotoLimits(1, 0, {
        purpose: "gallery",
        isVerified: false,
      });

      expect(result.canUpload).toBe(false);
      expect(result.reason).toContain("identity verification");
    });

    it("allows a verified worker to add a gallery photo under the five-slot cap", () => {
      const result = checkPhotoLimits(1, 0, {
        purpose: "gallery",
        isVerified: true,
      });

      expect(result.canUpload).toBe(true);
    });

    it("blocks a sixth active or pending photo server-side", () => {
      const result = checkPhotoLimits(4, 1, {
        purpose: "gallery",
        isVerified: true,
      });

      expect(result.canUpload).toBe(false);
    });

    it("allows four extra gallery submissions after one approved primary", () => {
      expect(
        checkPhotoLimits(1, 0, { purpose: "gallery", isVerified: true }).canUpload
      ).toBe(true);
      expect(
        checkPhotoLimits(1, 3, { purpose: "gallery", isVerified: true }).canUpload
      ).toBe(true);
      expect(
        checkPhotoLimits(1, 4, { purpose: "gallery", isVerified: true }).canUpload
      ).toBe(false);
    });

    it("keeps the primary pending cap at one competing submission", () => {
      const result = checkPhotoLimits(1, MAX_PENDING_PHOTOS, {
        purpose: "primary",
      });

      expect(result.canUpload).toBe(false);
      expect(result.reason).toBe(PHOTO_POLICY_COPY.pending);
    });
  });

  describe("PHOTO_POLICY_COPY", () => {
    it("should have all required copy fields", () => {
      expect(PHOTO_POLICY_COPY.helper).toBeDefined();
      expect(PHOTO_POLICY_COPY.rules).toBeDefined();
      expect(PHOTO_POLICY_COPY.pending).toBeDefined();
      expect(PHOTO_POLICY_COPY.rejected).toBeDefined();
    });

    it("should have designer-specified copy for helper", () => {
      expect(PHOTO_POLICY_COPY.helper).toBe(
        "Add a clear photo so venues recognise you. Face visible preferred."
      );
    });

    it("should have designer-specified copy for rules", () => {
      expect(PHOTO_POLICY_COPY.rules).toBe(
        "No nudes. Lingerie OK — we'll review before it goes live."
      );
    });

    it("should have designer-specified copy for pending", () => {
      expect(PHOTO_POLICY_COPY.pending).toBe(
        "Photo under review — your profile stays visible with your previous photo until approved."
      );
    });

    it("should have designer-specified copy for rejected", () => {
      expect(PHOTO_POLICY_COPY.rejected).toBe(
        "This photo didn't meet our guidelines. Try a clear, face-forward shot without nudity."
      );
    });
  });

  describe("constants", () => {
    it("should have MAX_PROFILE_PHOTOS set to 5", () => {
      expect(MAX_PROFILE_PHOTOS).toBe(5);
    });

    it("should have MAX_PENDING_PHOTOS set to 1", () => {
      expect(MAX_PENDING_PHOTOS).toBe(1);
    });
  });
});
