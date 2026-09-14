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
  calculateCompletenessScore,
  calculateViewScore,
  calculateInterestScore,
  calculateRecencyScore,
  calculateCompositeScore,
  mergeV11Criteria,
  DEFAULT_V11_CRITERIA,
  DEFAULT_SCORING_WEIGHTS,
  isCompositeTopTalentScore,
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

  describe("v1.1 Scoring Functions", () => {
    describe("mergeV11Criteria", () => {
      it("should return default criteria when no input provided", () => {
        const result = mergeV11Criteria();
        expect(result).toEqual(DEFAULT_V11_CRITERIA);
      });

      it("should merge partial criteria with defaults", () => {
        const result = mergeV11Criteria({
          timeWindowDays: 14,
          weights: { profileCompleteness: 30 },
        });
        expect(result.timeWindowDays).toBe(14);
        expect(result.weights.profileCompleteness).toBe(30);
        expect(result.weights.uniqueViews).toBe(DEFAULT_SCORING_WEIGHTS.uniqueViews);
      });

      it("should allow overriding all criteria", () => {
        const result = mergeV11Criteria({
          timeWindowDays: 7,
          topTalentThreshold: 0.2,
          minViews: 3,
          viewCapForMaxScore: 20,
          interestCapForMaxScore: 15,
          weights: {
            profileCompleteness: 20,
            uniqueViews: 35,
            interestRate: 30,
            recency: 15,
          },
        });
        expect(result.timeWindowDays).toBe(7);
        expect(result.weights.profileCompleteness).toBe(20);
        expect(result.weights.uniqueViews).toBe(35);
        expect(result.viewCapForMaxScore).toBe(20);
      });
    });

    describe("calculateCompletenessScore", () => {
      it("should return 0 for 0% completeness", () => {
        expect(calculateCompletenessScore(0, 25)).toBe(0);
      });

      it("should return max points for 100% completeness", () => {
        expect(calculateCompletenessScore(100, 25)).toBe(25);
      });

      it("should return proportional points for partial completeness", () => {
        expect(calculateCompletenessScore(50, 25)).toBe(12.5);
      });

      it("should handle completeness above 100%", () => {
        expect(calculateCompletenessScore(150, 25)).toBe(25);
      });

      it("should handle negative completeness", () => {
        expect(calculateCompletenessScore(-10, 25)).toBe(0);
      });

      it("should handle different max points", () => {
        expect(calculateCompletenessScore(100, 100)).toBe(100);
        expect(calculateCompletenessScore(100, 10)).toBe(10);
      });

      it("should round to 2 decimal places", () => {
        expect(calculateCompletenessScore(33, 25)).toBe(8.25);
      });
    });

    describe("calculateViewScore", () => {
      it("should return 0 for 0 views", () => {
        expect(calculateViewScore(0, 15, 30)).toBe(0);
      });

      it("should return 0 for negative views", () => {
        expect(calculateViewScore(-5, 15, 30)).toBe(0);
      });

      it("should return close to max for views at cap", () => {
        const score = calculateViewScore(15, 15, 30);
        expect(score).toBeGreaterThan(29);
        expect(score).toBeLessThanOrEqual(30);
      });

      it("should show diminishing returns (logarithmic)", () => {
        const score1 = calculateViewScore(1, 15, 30);
        const score5 = calculateViewScore(5, 15, 30);
        const score10 = calculateViewScore(10, 15, 30);
        const score15 = calculateViewScore(15, 15, 30);

        const diff1to5 = score5 - score1;
        const diff5to10 = score10 - score5;
        const diff10to15 = score15 - score10;

        expect(diff1to5).toBeGreaterThan(diff5to10);
        expect(diff5to10).toBeGreaterThan(diff10to15);
      });

      it("should handle zero cap gracefully", () => {
        expect(calculateViewScore(5, 0, 30)).toBe(0);
      });

      it("should cap at max points for very high view counts", () => {
        const score = calculateViewScore(1000, 15, 30);
        expect(score).toBeLessThanOrEqual(30);
      });
    });

    describe("calculateInterestScore", () => {
      it("should return 0 for 0 interests", () => {
        expect(calculateInterestScore(0, 10, 25)).toBe(0);
      });

      it("should return 0 for negative interests", () => {
        expect(calculateInterestScore(-3, 10, 25)).toBe(0);
      });

      it("should return close to max for interests at cap", () => {
        const score = calculateInterestScore(10, 10, 25);
        expect(score).toBeGreaterThan(24);
        expect(score).toBeLessThanOrEqual(25);
      });

      it("should show diminishing returns (logarithmic)", () => {
        const score1 = calculateInterestScore(1, 10, 25);
        const score3 = calculateInterestScore(3, 10, 25);
        const score6 = calculateInterestScore(6, 10, 25);
        const score10 = calculateInterestScore(10, 10, 25);

        const diff1to3 = score3 - score1;
        const diff3to6 = score6 - score3;
        const diff6to10 = score10 - score6;

        expect(diff1to3).toBeGreaterThan(diff3to6);
        expect(diff3to6).toBeGreaterThanOrEqual(diff6to10 - 0.5);
      });

      it("should handle zero cap gracefully", () => {
        expect(calculateInterestScore(5, 0, 25)).toBe(0);
      });
    });

    describe("calculateRecencyScore", () => {
      it("should return 0 for null updatedAt", () => {
        expect(calculateRecencyScore(null, 30, 20)).toBe(0);
      });

      it("should return max points for just-updated profile", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-06-15T12:00:00Z");
        expect(calculateRecencyScore(updatedAt, 30, 20, now)).toBe(20);
      });

      it("should return 0 for profile updated beyond window", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-05-01T12:00:00Z");
        expect(calculateRecencyScore(updatedAt, 30, 20, now)).toBe(0);
      });

      it("should return 0 for profile updated exactly at window boundary", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-05-16T12:00:00Z");
        expect(calculateRecencyScore(updatedAt, 30, 20, now)).toBe(0);
      });

      it("should return half points for profile updated at window midpoint", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-06-01T12:00:00Z");
        const score = calculateRecencyScore(updatedAt, 30, 20, now);
        expect(score).toBeCloseTo(10.67, 1);
      });

      it("should handle future updatedAt gracefully", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-06-20T12:00:00Z");
        expect(calculateRecencyScore(updatedAt, 30, 20, now)).toBe(20);
      });

      it("should handle zero time window", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-06-14T12:00:00Z");
        expect(calculateRecencyScore(updatedAt, 0, 20, now)).toBe(0);
      });

      it("should handle negative time window", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        const updatedAt = new Date("2024-06-14T12:00:00Z");
        expect(calculateRecencyScore(updatedAt, -10, 20, now)).toBe(0);
      });
    });

    describe("calculateCompositeScore", () => {
      const now = new Date("2024-06-15T12:00:00Z");

      describe("empty profile edge cases", () => {
        it("should return all zeros for completely empty profile", () => {
          const result = calculateCompositeScore(0, 0, 0, null, undefined, now);
          expect(result).toEqual({
            completenessScore: 0,
            viewScore: 0,
            interestScore: 0,
            recencyScore: 0,
            totalScore: 0,
          });
        });

        it("should return only completeness score for empty profile with some fields filled", () => {
          const result = calculateCompositeScore(40, 0, 0, null, undefined, now);
          expect(result.completenessScore).toBe(10);
          expect(result.viewScore).toBe(0);
          expect(result.interestScore).toBe(0);
          expect(result.recencyScore).toBe(0);
          expect(result.totalScore).toBe(10);
        });
      });

      describe("no views edge cases", () => {
        it("should score profile with completeness but no views", () => {
          const freshDate = new Date("2024-06-15T12:00:00Z");
          const result = calculateCompositeScore(
            100,
            0,
            5,
            freshDate,
            undefined,
            now
          );
          expect(result.completenessScore).toBe(25);
          expect(result.viewScore).toBe(0);
          expect(result.interestScore).toBeGreaterThan(0);
          expect(result.recencyScore).toBe(20);
          expect(result.totalScore).toBeGreaterThan(45);
        });
      });

      describe("no interests edge cases", () => {
        it("should score profile with views but no interests", () => {
          const freshDate = new Date("2024-06-15T12:00:00Z");
          const result = calculateCompositeScore(
            100,
            10,
            0,
            freshDate,
            undefined,
            now
          );
          expect(result.completenessScore).toBe(25);
          expect(result.viewScore).toBeGreaterThan(0);
          expect(result.interestScore).toBe(0);
          expect(result.recencyScore).toBe(20);
          expect(result.totalScore).toBeGreaterThan(45);
        });
      });

      describe("stale vs fresh profile comparison", () => {
        it("should score fresh profile higher than stale profile with same stats", () => {
          const freshDate = new Date("2024-06-15T12:00:00Z");
          const staleDate = new Date("2024-05-20T12:00:00Z");

          const freshResult = calculateCompositeScore(
            80,
            10,
            5,
            freshDate,
            undefined,
            now
          );
          const staleResult = calculateCompositeScore(
            80,
            10,
            5,
            staleDate,
            undefined,
            now
          );

          expect(freshResult.recencyScore).toBeGreaterThan(staleResult.recencyScore);
          expect(freshResult.totalScore).toBeGreaterThan(staleResult.totalScore);
        });

        it("should allow stale profile with better stats to beat fresh incomplete profile", () => {
          const freshDate = new Date("2024-06-15T12:00:00Z");
          const staleDate = new Date("2024-05-25T12:00:00Z");

          const freshIncompleteResult = calculateCompositeScore(
            30,
            2,
            0,
            freshDate,
            undefined,
            now
          );
          const staleCompleteResult = calculateCompositeScore(
            100,
            15,
            8,
            staleDate,
            undefined,
            now
          );

          expect(staleCompleteResult.totalScore).toBeGreaterThan(
            freshIncompleteResult.totalScore
          );
        });
      });

      describe("fully loaded profile", () => {
        it("should return close to max score for perfect profile", () => {
          const freshDate = new Date("2024-06-15T12:00:00Z");
          const result = calculateCompositeScore(
            100,
            15,
            10,
            freshDate,
            undefined,
            now
          );

          expect(result.completenessScore).toBe(25);
          expect(result.viewScore).toBeCloseTo(30, 0);
          expect(result.interestScore).toBeCloseTo(25, 0);
          expect(result.recencyScore).toBe(20);
          expect(result.totalScore).toBeGreaterThan(95);
        });
      });

      describe("custom weights", () => {
        it("should respect custom weight configuration", () => {
          const freshDate = new Date("2024-06-15T12:00:00Z");
          const customCriteria = {
            weights: {
              profileCompleteness: 50,
              uniqueViews: 20,
              interestRate: 20,
              recency: 10,
            },
          };

          const result = calculateCompositeScore(
            100,
            10,
            5,
            freshDate,
            customCriteria,
            now
          );

          expect(result.completenessScore).toBe(50);
          expect(result.recencyScore).toBe(10);
        });
      });

      describe("isCompositeTopTalentScore", () => {
        it("treats a near-max score as Top Talent at the default 10% threshold", () => {
          expect(isCompositeTopTalentScore(90)).toBe(true);
          expect(isCompositeTopTalentScore(89.9)).toBe(false);
        });
      });
    });
  });
});
