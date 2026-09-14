import { describe, it, expect } from "vitest";
import {
  calculateAge,
  meetsMinimumAge,
  isAgeValid,
  getMinimumAgeDateOfBirth,
  parseDateOfBirth,
  formatDateOfBirth,
  MIN_AGE_REQUIREMENT,
} from "../age-verification";

describe("age-verification helpers", () => {
  describe("MIN_AGE_REQUIREMENT", () => {
    it("should be 20", () => {
      expect(MIN_AGE_REQUIREMENT).toBe(20);
    });
  });

  describe("calculateAge", () => {
    it("should calculate exact age when birthday has passed this year", () => {
      const dob = new Date("2000-01-15");
      const reference = new Date("2024-06-15");
      expect(calculateAge(dob, reference)).toBe(24);
    });

    it("should calculate age before birthday this year", () => {
      const dob = new Date("2000-07-15");
      const reference = new Date("2024-06-15");
      expect(calculateAge(dob, reference)).toBe(23);
    });

    it("should return 0 for someone born less than a year ago", () => {
      const dob = new Date("2024-01-15");
      const reference = new Date("2024-06-15");
      expect(calculateAge(dob, reference)).toBe(0);
    });

    it("should handle exact birthday (age increments)", () => {
      const dob = new Date("2000-06-15");
      const reference = new Date("2024-06-15");
      expect(calculateAge(dob, reference)).toBe(24);
    });

    it("should handle day before birthday correctly", () => {
      const dob = new Date("2000-06-16");
      const reference = new Date("2024-06-15");
      expect(calculateAge(dob, reference)).toBe(23);
    });

    it("should handle leap year birthday (Feb 29)", () => {
      const dob = new Date("2000-02-29");
      const reference = new Date("2024-02-28");
      expect(calculateAge(dob, reference)).toBe(23);
    });

    it("should handle leap year birthday on Feb 29 in leap year", () => {
      const dob = new Date("2000-02-29");
      const reference = new Date("2024-02-29");
      expect(calculateAge(dob, reference)).toBe(24);
    });
  });

  describe("meetsMinimumAge (MIN_AGE_REQUIREMENT is 20)", () => {
    it("should return true for someone exactly 20 years old", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("2004-06-15");
      expect(meetsMinimumAge(dob, reference)).toBe(true);
    });

    it("should return true for someone over 20", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("1990-01-01");
      expect(meetsMinimumAge(dob, reference)).toBe(true);
    });

    it("should return false for someone under 20", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("2006-01-01");
      expect(meetsMinimumAge(dob, reference)).toBe(false);
    });

    it("should return false for someone one day before 20th birthday", () => {
      const reference = new Date("2024-06-14");
      const dob = new Date("2004-06-15");
      expect(meetsMinimumAge(dob, reference)).toBe(false);
    });

    it("should return true for someone one day after 20th birthday", () => {
      const reference = new Date("2024-06-16");
      const dob = new Date("2004-06-15");
      expect(meetsMinimumAge(dob, reference)).toBe(true);
    });

    it("should handle very old dates", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("1924-06-15");
      expect(meetsMinimumAge(dob, reference)).toBe(true);
    });
  });

  describe("isAgeValid", () => {
    it("should return true for age 20", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("2004-06-15");
      expect(isAgeValid(dob, reference)).toBe(true);
    });

    it("should return true for age 50", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("1974-06-15");
      expect(isAgeValid(dob, reference)).toBe(true);
    });

    it("should return true for age 120", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("1904-06-15");
      expect(isAgeValid(dob, reference)).toBe(true);
    });

    it("should return false for age 19", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("2005-06-15");
      expect(isAgeValid(dob, reference)).toBe(false);
    });

    it("should return false for age over 120", () => {
      const reference = new Date("2024-06-15");
      const dob = new Date("1900-06-15");
      expect(isAgeValid(dob, reference)).toBe(false);
    });
  });

  describe("getMinimumAgeDateOfBirth (returns MIN_AGE_REQUIREMENT years ago)", () => {
    it("should return date 20 years before reference", () => {
      const reference = new Date("2024-06-15");
      const result = getMinimumAgeDateOfBirth(reference);
      expect(result.getFullYear()).toBe(2004);
      expect(result.getMonth()).toBe(5); // June is month 5
      expect(result.getDate()).toBe(15);
    });

    it("should handle leap year (Feb 29 stays Feb 29 in 2004 leap year)", () => {
      const reference = new Date("2024-02-29");
      const result = getMinimumAgeDateOfBirth(reference);
      expect(result.getFullYear()).toBe(2004);
      expect(result.getMonth()).toBe(1); // Feb in 2004 (leap year)
      expect(result.getDate()).toBe(29);
    });
  });

  describe("parseDateOfBirth", () => {
    it("should parse valid date string (YYYY-MM-DD)", () => {
      const result = parseDateOfBirth("2000-06-15");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2000);
    });

    it("should parse ISO date string", () => {
      const result = parseDateOfBirth("2000-06-15T00:00:00Z");
      expect(result).toBeInstanceOf(Date);
    });

    it("should return null for invalid date string", () => {
      expect(parseDateOfBirth("not-a-date")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseDateOfBirth("")).toBeNull();
    });
  });

  describe("formatDateOfBirth", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date("2000-06-15T12:00:00Z");
      expect(formatDateOfBirth(date)).toBe("2000-06-15");
    });

    it("should handle single digit month and day", () => {
      const date = new Date("2000-01-05T12:00:00Z");
      expect(formatDateOfBirth(date)).toBe("2000-01-05");
    });
  });
});
