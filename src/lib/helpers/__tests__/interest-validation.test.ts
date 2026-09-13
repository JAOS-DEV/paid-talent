import { describe, it, expect } from "vitest";
import {
  validateCreateInterest,
  canExpressInterest,
  canViewInterests,
  validateUUID,
  sanitizeMessage,
  createInterestSchema,
} from "../interest-validation";

describe("interest-validation helpers", () => {
  describe("createInterestSchema", () => {
    it("should accept valid input with message", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        message: "I am interested in your profile",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid input without message", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject message over 500 characters", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        message: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should accept message with exactly 500 characters", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        message: "a".repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing workerProfileId", () => {
      const result = createInterestSchema.safeParse({
        message: "Hello",
      });
      expect(result.success).toBe(false);
    });
    it("should accept optional null openingId for general interests", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        openingId: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.openingId).toBeNull();
      }
    });

    it("should accept optional openingId uuid", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        openingId: "123e4567-e89b-12d3-a456-426614174001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid openingId", () => {
      const result = createInterestSchema.safeParse({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        openingId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateCreateInterest", () => {
    it("should return success with valid data", () => {
      const result = validateCreateInterest({
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Interested!",
      });
      expect(result.success).toBe(true);
      expect(result.data?.workerProfileId).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(result.data?.message).toBe("Interested!");
    });

    it("should return errors with invalid data", () => {
      const result = validateCreateInterest({
        workerProfileId: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("should return errors for null input", () => {
      const result = validateCreateInterest(null);
      expect(result.success).toBe(false);
    });

    it("should return errors for empty object", () => {
      const result = validateCreateInterest({});
      expect(result.success).toBe(false);
    });
  });

  describe("canExpressInterest", () => {
    it("should return unauthenticated when no userId", () => {
      expect(canExpressInterest(null, "recruiter")).toEqual({
        authorized: false,
        reason: "unauthenticated",
      });
    });

    it("should return unauthenticated when userId undefined", () => {
      expect(canExpressInterest(undefined, "recruiter")).toEqual({
        authorized: false,
        reason: "unauthenticated",
      });
    });

    it("should return wrong_role for worker trying to express interest", () => {
      expect(canExpressInterest("user-123", "worker")).toEqual({
        authorized: false,
        reason: "wrong_role",
      });
    });

    it("should return wrong_role for null role", () => {
      expect(canExpressInterest("user-123", null)).toEqual({
        authorized: false,
        reason: "wrong_role",
      });
    });

    it("should return authorized for recruiter", () => {
      expect(canExpressInterest("user-123", "recruiter")).toEqual({
        authorized: true,
      });
    });
  });

  describe("canViewInterests", () => {
    it("should return unauthenticated when no userId", () => {
      expect(canViewInterests(null, "worker")).toEqual({
        authorized: false,
        reason: "unauthenticated",
      });
    });

    it("should return authorized for worker", () => {
      expect(canViewInterests("user-123", "worker")).toEqual({
        authorized: true,
      });
    });

    it("should return authorized for recruiter", () => {
      expect(canViewInterests("user-123", "recruiter")).toEqual({
        authorized: true,
      });
    });

    it("should return forbidden for null role", () => {
      expect(canViewInterests("user-123", null)).toEqual({
        authorized: false,
        reason: "forbidden",
      });
    });

    it("should return forbidden for undefined role", () => {
      expect(canViewInterests("user-123", undefined)).toEqual({
        authorized: false,
        reason: "forbidden",
      });
    });
  });

  describe("validateUUID", () => {
    it("should return true for valid UUID v4", () => {
      expect(validateUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    });

    it("should return true for valid UUID v1", () => {
      expect(validateUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    });

    it("should return false for invalid UUID", () => {
      expect(validateUUID("not-a-uuid")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(validateUUID("")).toBe(false);
    });

    it("should return false for UUID without dashes", () => {
      expect(validateUUID("123e4567e89b12d3a456426614174000")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(validateUUID("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
    });
  });

  describe("sanitizeMessage", () => {
    it("should return null for undefined", () => {
      expect(sanitizeMessage(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(sanitizeMessage("")).toBeNull();
    });

    it("should return null for whitespace-only string", () => {
      expect(sanitizeMessage("   ")).toBeNull();
    });

    it("should trim whitespace", () => {
      expect(sanitizeMessage("  hello  ")).toBe("hello");
    });

    it("should truncate to 500 characters", () => {
      const longMessage = "a".repeat(600);
      const result = sanitizeMessage(longMessage);
      expect(result?.length).toBe(500);
    });

    it("should preserve messages under 500 characters", () => {
      const message = "Hello, I am interested in your profile.";
      expect(sanitizeMessage(message)).toBe(message);
    });
  });
});
