import { describe, it, expect } from "vitest";
import {
  validateSearchParams,
  buildFilterCriteria,
  matchesSearchCriteria,
  normalizeSearchQuery,
  isValidPagination,
  type SearchFilterCriteria,
  type WorkerProfile,
} from "../search-filters";

describe("search-filters helpers", () => {
  describe("validateSearchParams", () => {
    it("should validate empty params with defaults", () => {
      const result = validateSearchParams({});
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        limit: 20,
        offset: 0,
      });
    });

    it("should validate all params", () => {
      const result = validateSearchParams({
        query: "bartender",
        role: "Server",
        area: "Bangkok",
        availability: "Full-time",
        verified: "true",
        limit: 50,
        offset: 10,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        query: "bartender",
        role: "Server",
        area: "Bangkok",
        availability: "Full-time",
        verified: "true",
        limit: 50,
        offset: 10,
      });
    });

    it("should reject invalid limit (too high)", () => {
      const result = validateSearchParams({ limit: 200 });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject invalid limit (too low)", () => {
      const result = validateSearchParams({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject negative offset", () => {
      const result = validateSearchParams({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject invalid verified value", () => {
      const result = validateSearchParams({ verified: "yes" });
      expect(result.success).toBe(false);
    });

    it("should coerce string numbers to numbers", () => {
      const result = validateSearchParams({ limit: "30", offset: "5" });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(30);
      expect(result.data?.offset).toBe(5);
    });
  });

  describe("buildFilterCriteria", () => {
    it("should build criteria from params", () => {
      const criteria = buildFilterCriteria({
        query: "test",
        role: "Bartender",
        area: "Pattaya",
        availability: "Weekends",
        verified: "true",
        limit: 20,
        offset: 0,
      });
      expect(criteria).toEqual({
        query: "test",
        role: "Bartender",
        area: "Pattaya",
        availability: "Weekends",
        verifiedOnly: true,
      });
    });

    it("should handle empty params", () => {
      const criteria = buildFilterCriteria({ limit: 20, offset: 0 });
      expect(criteria).toEqual({
        query: undefined,
        role: undefined,
        area: undefined,
        availability: undefined,
        verifiedOnly: false,
      });
    });

    it("should set verifiedOnly false when verified is 'false'", () => {
      const criteria = buildFilterCriteria({
        verified: "false",
        limit: 20,
        offset: 0,
      });
      expect(criteria.verifiedOnly).toBe(false);
    });
  });

  describe("matchesSearchCriteria", () => {
    const baseProfile: WorkerProfile = {
      displayName: "John Bartender",
      description: "Experienced bartender in Bangkok nightlife",
      jobRoles: ["Bartender", "Server"],
      area: "Bangkok",
      availability: "Full-time",
      isVerified: true,
    };

    it("should match profile with no criteria", () => {
      const criteria: SearchFilterCriteria = { verifiedOnly: false };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should filter by verified status", () => {
      const criteria: SearchFilterCriteria = { verifiedOnly: true };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);

      const unverified = { ...baseProfile, isVerified: false };
      expect(matchesSearchCriteria(unverified, criteria)).toBe(false);
    });

    it("should match query in display name", () => {
      const criteria: SearchFilterCriteria = {
        query: "john",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should match query in description", () => {
      const criteria: SearchFilterCriteria = {
        query: "nightlife",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should not match query when not found", () => {
      const criteria: SearchFilterCriteria = {
        query: "chef",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(false);
    });

    it("should match by role (case insensitive)", () => {
      const criteria: SearchFilterCriteria = {
        role: "bartender",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should not match wrong role", () => {
      const criteria: SearchFilterCriteria = {
        role: "Chef",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(false);
    });

    it("should match by area (partial, case insensitive)", () => {
      const criteria: SearchFilterCriteria = {
        area: "bang",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should not match wrong area", () => {
      const criteria: SearchFilterCriteria = {
        area: "Phuket",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(false);
    });

    it("should match by availability (partial, case insensitive)", () => {
      const criteria: SearchFilterCriteria = {
        availability: "full",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should not match wrong availability", () => {
      const criteria: SearchFilterCriteria = {
        availability: "Part-time",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(false);
    });

    it("should match with multiple criteria", () => {
      const criteria: SearchFilterCriteria = {
        query: "bartender",
        role: "Bartender",
        area: "Bangkok",
        availability: "Full-time",
        verifiedOnly: true,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(true);
    });

    it("should fail if any criterion fails", () => {
      const criteria: SearchFilterCriteria = {
        query: "bartender",
        role: "Bartender",
        area: "Phuket", // wrong area
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(baseProfile, criteria)).toBe(false);
    });

    it("should handle profile with null description", () => {
      const profile = { ...baseProfile, description: null };
      const criteria: SearchFilterCriteria = {
        query: "john",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(profile, criteria)).toBe(true);

      const notFoundCriteria: SearchFilterCriteria = {
        query: "nightlife",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(profile, notFoundCriteria)).toBe(false);
    });

    it("should handle profile with null area", () => {
      const profile = { ...baseProfile, area: null };
      const criteria: SearchFilterCriteria = {
        area: "Bangkok",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(profile, criteria)).toBe(false);
    });

    it("should handle profile with null availability", () => {
      const profile = { ...baseProfile, availability: null };
      const criteria: SearchFilterCriteria = {
        availability: "Full-time",
        verifiedOnly: false,
      };
      expect(matchesSearchCriteria(profile, criteria)).toBe(false);
    });
  });

  describe("normalizeSearchQuery", () => {
    it("should return undefined for null input", () => {
      expect(normalizeSearchQuery(null)).toBeUndefined();
    });

    it("should return undefined for undefined input", () => {
      expect(normalizeSearchQuery(undefined)).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      expect(normalizeSearchQuery("")).toBeUndefined();
    });

    it("should return undefined for whitespace only", () => {
      expect(normalizeSearchQuery("   ")).toBeUndefined();
    });

    it("should trim whitespace", () => {
      expect(normalizeSearchQuery("  bartender  ")).toBe("bartender");
    });

    it("should truncate to 100 characters", () => {
      const longQuery = "a".repeat(150);
      const result = normalizeSearchQuery(longQuery);
      expect(result).toHaveLength(100);
    });
  });

  describe("isValidPagination", () => {
    it("should accept valid pagination", () => {
      expect(isValidPagination(20, 0)).toBe(true);
      expect(isValidPagination(1, 0)).toBe(true);
      expect(isValidPagination(100, 0)).toBe(true);
      expect(isValidPagination(50, 100)).toBe(true);
    });

    it("should reject limit below 1", () => {
      expect(isValidPagination(0, 0)).toBe(false);
    });

    it("should reject limit above 100", () => {
      expect(isValidPagination(101, 0)).toBe(false);
    });

    it("should reject negative offset", () => {
      expect(isValidPagination(20, -1)).toBe(false);
    });
  });
});
