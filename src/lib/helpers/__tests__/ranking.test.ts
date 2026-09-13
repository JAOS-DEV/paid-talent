import { describe, it, expect } from "vitest";
import {
  mergeCriteria,
  calculateTopTalentCutoffIndex,
  isScoreAboveThreshold,
  determineTopTalentStatus,
  calculateCutoffScore,
  rankProfiles,
  getStartDateForTimeWindow,
  DEFAULT_RANKING_CRITERIA,
} from "../ranking";

describe("ranking helpers", () => {
  describe("mergeCriteria", () => {
    it("should return default criteria when no input provided", () => {
      const result = mergeCriteria();
      expect(result).toEqual(DEFAULT_RANKING_CRITERIA);
    });

    it("should merge partial criteria with defaults", () => {
      const result = mergeCriteria({ topTalentThreshold: 0.2 });
      expect(result).toEqual({
        timeWindowDays: 30,
        topTalentThreshold: 0.2,
        minViews: 5,
      });
    });

    it("should allow overriding all criteria", () => {
      const result = mergeCriteria({
        timeWindowDays: 7,
        topTalentThreshold: 0.05,
        minViews: 10,
      });
      expect(result).toEqual({
        timeWindowDays: 7,
        topTalentThreshold: 0.05,
        minViews: 10,
      });
    });
  });

  describe("calculateTopTalentCutoffIndex", () => {
    it("should return 1 for 10 profiles at 10% threshold", () => {
      expect(calculateTopTalentCutoffIndex(10, 0.1)).toBe(1);
    });

    it("should return 10 for 100 profiles at 10% threshold", () => {
      expect(calculateTopTalentCutoffIndex(100, 0.1)).toBe(10);
    });

    it("should return at least 1 even for small pools", () => {
      expect(calculateTopTalentCutoffIndex(3, 0.1)).toBe(1);
    });

    it("should floor the result", () => {
      expect(calculateTopTalentCutoffIndex(15, 0.1)).toBe(1);
    });

    it("should handle 0 profiles", () => {
      expect(calculateTopTalentCutoffIndex(0, 0.1)).toBe(1);
    });
  });

  describe("isScoreAboveThreshold", () => {
    it("should return true when score meets both thresholds", () => {
      expect(isScoreAboveThreshold(10, 8, 5)).toBe(true);
    });

    it("should return false when score below minViews", () => {
      expect(isScoreAboveThreshold(3, 2, 5)).toBe(false);
    });

    it("should return false when score below cutoff", () => {
      expect(isScoreAboveThreshold(7, 10, 5)).toBe(false);
    });

    it("should return true when score equals cutoff", () => {
      expect(isScoreAboveThreshold(10, 10, 5)).toBe(true);
    });

    it("should return true when score equals minViews exactly", () => {
      expect(isScoreAboveThreshold(5, 3, 5)).toBe(true);
    });
  });

  describe("determineTopTalentStatus", () => {
    it("should return false if viewCount is below minViews", () => {
      const allCounts = [100, 50, 30, 20, 10, 5, 3];
      expect(
        determineTopTalentStatus(4, allCounts, { minViews: 5 })
      ).toBe(false);
    });

    it("should return false for empty view counts array", () => {
      expect(determineTopTalentStatus(10, [])).toBe(false);
    });

    it("should identify top 10% as Top Talent", () => {
      const allCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      expect(
        determineTopTalentStatus(100, allCounts, { topTalentThreshold: 0.1 })
      ).toBe(true);
    });

    it("should NOT identify bottom 90% as Top Talent", () => {
      const allCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      expect(
        determineTopTalentStatus(60, allCounts, { topTalentThreshold: 0.1 })
      ).toBe(false);
    });

    it("should handle ties at the cutoff correctly", () => {
      const allCounts = [100, 100, 100, 50, 50, 50, 50, 50, 50, 50];
      expect(
        determineTopTalentStatus(100, allCounts, { topTalentThreshold: 0.1 })
      ).toBe(true);
    });

    it("should use default criteria when none provided", () => {
      const allCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      expect(determineTopTalentStatus(100, allCounts)).toBe(true);
    });

    it("should work with custom threshold of 20%", () => {
      const allCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      expect(
        determineTopTalentStatus(90, allCounts, { topTalentThreshold: 0.2 })
      ).toBe(true);
    });
  });

  describe("calculateCutoffScore", () => {
    it("should return 0 for empty array", () => {
      expect(calculateCutoffScore([], 0.1)).toBe(0);
    });

    it("should return highest score at 10% for 10 profiles", () => {
      const counts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      expect(calculateCutoffScore(counts, 0.1)).toBe(100);
    });

    it("should return 2nd highest at 20% for 10 profiles", () => {
      const counts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      expect(calculateCutoffScore(counts, 0.2)).toBe(90);
    });

    it("should sort unsorted input correctly", () => {
      const counts = [30, 100, 50, 10, 90, 70, 40, 60, 20, 80];
      expect(calculateCutoffScore(counts, 0.1)).toBe(100);
    });
  });

  describe("rankProfiles", () => {
    it("should rank profiles by viewCount descending", () => {
      const profiles = [
        { id: "a", viewCount: 30 },
        { id: "b", viewCount: 100 },
        { id: "c", viewCount: 50 },
      ];

      const ranked = rankProfiles(profiles);

      expect(ranked[0]).toEqual({ id: "b", viewCount: 100, rank: 1 });
      expect(ranked[1]).toEqual({ id: "c", viewCount: 50, rank: 2 });
      expect(ranked[2]).toEqual({ id: "a", viewCount: 30, rank: 3 });
    });

    it("should handle empty array", () => {
      expect(rankProfiles([])).toEqual([]);
    });

    it("should handle single profile", () => {
      const profiles = [{ id: "a", viewCount: 10 }];
      const ranked = rankProfiles(profiles);
      expect(ranked).toEqual([{ id: "a", viewCount: 10, rank: 1 }]);
    });

    it("should preserve additional properties", () => {
      const profiles = [
        { id: "a", viewCount: 30, name: "Alice" },
        { id: "b", viewCount: 100, name: "Bob" },
      ];

      const ranked = rankProfiles(profiles);

      expect(ranked[0].name).toBe("Bob");
      expect(ranked[1].name).toBe("Alice");
    });
  });

  describe("getStartDateForTimeWindow", () => {
    it("should return date 30 days ago by default", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      const result = getStartDateForTimeWindow(30, now);
      expect(result.toISOString()).toBe("2024-05-16T12:00:00.000Z");
    });

    it("should handle 7 day window", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      const result = getStartDateForTimeWindow(7, now);
      expect(result.toISOString()).toBe("2024-06-08T12:00:00.000Z");
    });

    it("should handle month boundary", () => {
      const now = new Date("2024-01-05T12:00:00Z");
      const result = getStartDateForTimeWindow(10, now);
      expect(result.toISOString()).toBe("2023-12-26T12:00:00.000Z");
    });

    it("should handle year boundary", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const result = getStartDateForTimeWindow(30, now);
      expect(result.toISOString()).toBe("2023-12-16T12:00:00.000Z");
    });
  });
});
