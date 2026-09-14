import { describe, it, expect } from "vitest";
import {
  isSearchableWorker,
  isVerifiedStatus,
  canTransitionVerificationStatus,
  getVerificationStatusDescription,
  decisionToStatus,
  computeFileSha256,
  getRetentionExpiryDate,
  generateChallengeCode,
  formatChallengeCodeForDisplay,
  isChallengeCodeExpired,
  validateVerificationSubmission,
  validateAdminApproval,
  VERIFICATION_RETENTION_DAYS,
  CHALLENGE_CODE_EXPIRY_MINUTES,
} from "../index";
import type { VerificationStatus } from "@/lib/db/schema";

describe("verification helpers", () => {
  describe("isSearchableWorker", () => {
    it("should return not searchable for null profile", () => {
      const result = isSearchableWorker(null);
      expect(result.isSearchable).toBe(false);
      expect(result.reason).toBe("not_verified");
    });

    it("should return not searchable for unpublished profile", () => {
      const result = isSearchableWorker({
        verificationStatus: "verified",
        isPublished: false,
      });
      expect(result.isSearchable).toBe(false);
      expect(result.reason).toBe("not_published");
    });

    it("should return searchable for verified and published profile", () => {
      const result = isSearchableWorker({
        verificationStatus: "verified",
        isPublished: true,
      });
      expect(result.isSearchable).toBe(true);
      expect(result.reason).toBe("verified");
    });

    it("should return not searchable for pending verification", () => {
      const result = isSearchableWorker({
        verificationStatus: "pending",
        isPublished: true,
      });
      expect(result.isSearchable).toBe(false);
      expect(result.reason).toBe("pending_verification");
    });

    it("should return not searchable for rejected verification", () => {
      const result = isSearchableWorker({
        verificationStatus: "rejected",
        isPublished: true,
      });
      expect(result.isSearchable).toBe(false);
      expect(result.reason).toBe("rejected");
    });

    it("should return not searchable for unverified status", () => {
      const result = isSearchableWorker({
        verificationStatus: "unverified",
        isPublished: true,
      });
      expect(result.isSearchable).toBe(false);
      expect(result.reason).toBe("not_verified");
    });
  });

  describe("isVerifiedStatus", () => {
    it("should return true for verified status", () => {
      expect(isVerifiedStatus("verified")).toBe(true);
    });

    it("should return false for other statuses", () => {
      expect(isVerifiedStatus("unverified")).toBe(false);
      expect(isVerifiedStatus("pending")).toBe(false);
      expect(isVerifiedStatus("rejected")).toBe(false);
    });
  });

  describe("canTransitionVerificationStatus", () => {
    it("should not allow same status transition", () => {
      const result = canTransitionVerificationStatus("pending", "pending");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already");
    });

    it("should allow unverified -> pending", () => {
      const result = canTransitionVerificationStatus("unverified", "pending");
      expect(result.allowed).toBe(true);
    });

    it("should allow pending -> verified", () => {
      const result = canTransitionVerificationStatus("pending", "verified");
      expect(result.allowed).toBe(true);
    });

    it("should allow pending -> rejected", () => {
      const result = canTransitionVerificationStatus("pending", "rejected");
      expect(result.allowed).toBe(true);
    });

    it("should allow rejected -> pending (resubmission)", () => {
      const result = canTransitionVerificationStatus("rejected", "pending");
      expect(result.allowed).toBe(true);
    });

    it("should allow verified -> rejected (revocation)", () => {
      const result = canTransitionVerificationStatus("verified", "rejected");
      expect(result.allowed).toBe(true);
    });

    it("should not allow unverified -> verified (skip pending)", () => {
      const result = canTransitionVerificationStatus("unverified", "verified");
      expect(result.allowed).toBe(false);
    });

    it("should not allow unverified -> rejected", () => {
      const result = canTransitionVerificationStatus("unverified", "rejected");
      expect(result.allowed).toBe(false);
    });
  });

  describe("getVerificationStatusDescription", () => {
    it("should return descriptions for all statuses", () => {
      const statuses: VerificationStatus[] = [
        "unverified",
        "pending",
        "verified",
        "rejected",
      ];
      for (const status of statuses) {
        const desc = getVerificationStatusDescription(status);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe("string");
      }
    });
  });

  describe("decisionToStatus", () => {
    it("should map pending_submitted to pending", () => {
      expect(decisionToStatus("pending_submitted")).toBe("pending");
    });

    it("should map approved to verified", () => {
      expect(decisionToStatus("approved")).toBe("verified");
    });

    it("should map rejected to rejected", () => {
      expect(decisionToStatus("rejected")).toBe("rejected");
    });

    it("should map revoked to rejected", () => {
      expect(decisionToStatus("revoked")).toBe("rejected");
    });
  });

  describe("computeFileSha256", () => {
    it("should compute consistent hash for same content", () => {
      const buffer = Buffer.from("test content");
      const hash1 = computeFileSha256(buffer);
      const hash2 = computeFileSha256(buffer);
      expect(hash1).toBe(hash2);
    });

    it("should compute different hashes for different content", () => {
      const buffer1 = Buffer.from("test content 1");
      const buffer2 = Buffer.from("test content 2");
      const hash1 = computeFileSha256(buffer1);
      const hash2 = computeFileSha256(buffer2);
      expect(hash1).not.toBe(hash2);
    });

    it("should return 64-character hex string", () => {
      const buffer = Buffer.from("test");
      const hash = computeFileSha256(buffer);
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe("getRetentionExpiryDate", () => {
    it("should add default 30 days to decision date", () => {
      const decisionDate = new Date("2024-01-01T00:00:00Z");
      const expiryDate = getRetentionExpiryDate(decisionDate);
      expect(expiryDate.toISOString()).toBe("2024-01-31T00:00:00.000Z");
    });

    it("should add custom retention days", () => {
      const decisionDate = new Date("2024-01-01T00:00:00Z");
      const expiryDate = getRetentionExpiryDate(decisionDate, 60);
      expect(expiryDate.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    });

    it("should not modify original date", () => {
      const decisionDate = new Date("2024-01-01T00:00:00Z");
      const originalTime = decisionDate.getTime();
      getRetentionExpiryDate(decisionDate);
      expect(decisionDate.getTime()).toBe(originalTime);
    });
  });

  describe("challenge code functions", () => {
    describe("generateChallengeCode", () => {
      it("should generate 6-digit string", () => {
        const code = generateChallengeCode();
        expect(code).toHaveLength(6);
        expect(/^\d{6}$/.test(code)).toBe(true);
      });

      it("should generate codes between 100000 and 999999", () => {
        for (let i = 0; i < 100; i++) {
          const code = parseInt(generateChallengeCode(), 10);
          expect(code).toBeGreaterThanOrEqual(100000);
          expect(code).toBeLessThanOrEqual(999999);
        }
      });
    });

    describe("formatChallengeCodeForDisplay", () => {
      it("should format code with hyphen", () => {
        expect(formatChallengeCodeForDisplay("123456")).toBe("123-456");
      });
    });

    describe("isChallengeCodeExpired", () => {
      it("should return false for recently issued code", () => {
        const now = new Date();
        expect(isChallengeCodeExpired(now)).toBe(false);
      });

      it("should return true for code issued over 30 minutes ago", () => {
        const oldDate = new Date();
        oldDate.setMinutes(oldDate.getMinutes() - 31);
        expect(isChallengeCodeExpired(oldDate)).toBe(true);
      });

      it("should return false for code issued 29 minutes ago", () => {
        const recentDate = new Date();
        recentDate.setMinutes(recentDate.getMinutes() - 29);
        expect(isChallengeCodeExpired(recentDate)).toBe(false);
      });
    });
  });

  describe("validateVerificationSubmission", () => {
    it("should reject submission without ID document (selfie-only)", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: null,
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        challengeIssuedAt: new Date(),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("ID document is required");
    });

    it("should reject submission without liveness video (selfie-only)", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: "doc-key",
        livenessVideoKey: null,
        challengeCode: "123456",
        challengeIssuedAt: new Date(),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Liveness video is required");
    });

    it("should reject submission without challenge code", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: null,
        challengeIssuedAt: new Date(),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Challenge code is required");
    });

    it("should reject submission with expired challenge code", () => {
      const expiredDate = new Date();
      expiredDate.setMinutes(expiredDate.getMinutes() - 31);

      const result = validateVerificationSubmission({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        challengeIssuedAt: expiredDate,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("expired"))).toBe(true);
    });

    it("should accept valid complete submission", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        challengeIssuedAt: new Date(),
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject submission when ID key does not match the bound challenge ID", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: "new-doc-key",
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        challengeIssuedAt: new Date(),
        boundIdDocumentKey: "bound-doc-key",
      });
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes("does not match"))
      ).toBe(true);
    });

    it("should accept submission when ID key matches the bound challenge ID", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        challengeIssuedAt: new Date(),
        boundIdDocumentKey: "doc-key",
      });
      expect(result.isValid).toBe(true);
    });

    it("should collect all errors for completely invalid submission", () => {
      const result = validateVerificationSubmission({
        idDocumentKey: null,
        livenessVideoKey: null,
        challengeCode: null,
        challengeIssuedAt: null,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("validateAdminApproval", () => {
    it("should reject approval without ID document", () => {
      const result = validateAdminApproval({
        idDocumentKey: null,
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        verificationStatus: "pending",
      });
      expect(result.canApprove).toBe(false);
      expect(result.errors.some((e) => e.includes("ID document"))).toBe(true);
    });

    it("should reject approval without liveness video", () => {
      const result = validateAdminApproval({
        idDocumentKey: "doc-key",
        livenessVideoKey: null,
        challengeCode: "123456",
        verificationStatus: "pending",
      });
      expect(result.canApprove).toBe(false);
      expect(result.errors.some((e) => e.includes("Liveness video"))).toBe(
        true
      );
    });

    it("should reject approval without challenge code", () => {
      const result = validateAdminApproval({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: null,
        verificationStatus: "pending",
      });
      expect(result.canApprove).toBe(false);
      expect(result.errors.some((e) => e.includes("Challenge code"))).toBe(
        true
      );
    });

    it("should reject approval for non-pending status", () => {
      const result = validateAdminApproval({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        verificationStatus: "verified",
      });
      expect(result.canApprove).toBe(false);
      expect(result.errors.some((e) => e.includes("not in pending"))).toBe(
        true
      );
    });

    it("should allow approval with all requirements met", () => {
      const result = validateAdminApproval({
        idDocumentKey: "doc-key",
        livenessVideoKey: "video-key",
        challengeCode: "123456",
        verificationStatus: "pending",
      });
      expect(result.canApprove).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("constants", () => {
    it("should have VERIFICATION_RETENTION_DAYS defaulting to 30", () => {
      expect(VERIFICATION_RETENTION_DAYS).toBe(30);
    });

    it("should have CHALLENGE_CODE_EXPIRY_MINUTES set to 30", () => {
      expect(CHALLENGE_CODE_EXPIRY_MINUTES).toBe(30);
    });
  });
});
