import { describe, it, expect } from "vitest";
import { locales, defaultLocale, localeNames, isValidLocale, type Locale } from "../config";

describe("i18n config", () => {
  describe("locales", () => {
    it("should include en and th", () => {
      expect(locales).toContain("en");
      expect(locales).toContain("th");
    });

    it("should have exactly 2 locales", () => {
      expect(locales.length).toBe(2);
    });
  });

  describe("defaultLocale", () => {
    it("should be en", () => {
      expect(defaultLocale).toBe("en");
    });

    it("should be included in locales", () => {
      expect(locales).toContain(defaultLocale);
    });
  });

  describe("localeNames", () => {
    it("should have names for all locales", () => {
      for (const locale of locales) {
        expect(localeNames[locale]).toBeDefined();
        expect(typeof localeNames[locale]).toBe("string");
        expect(localeNames[locale].length).toBeGreaterThan(0);
      }
    });

    it("should have correct English name", () => {
      expect(localeNames.en).toBe("English");
    });

    it("should have correct Thai name", () => {
      expect(localeNames.th).toBe("ไทย");
    });
  });

  describe("isValidLocale", () => {
    it("should return true for valid locales", () => {
      expect(isValidLocale("en")).toBe(true);
      expect(isValidLocale("th")).toBe(true);
    });

    it("should return false for invalid locales", () => {
      expect(isValidLocale("de")).toBe(false);
      expect(isValidLocale("fr")).toBe(false);
      expect(isValidLocale("")).toBe(false);
      expect(isValidLocale("english")).toBe(false);
    });

    it("should narrow type correctly", () => {
      const maybeLocale = "en";
      if (isValidLocale(maybeLocale)) {
        const locale: Locale = maybeLocale;
        expect(locale).toBe("en");
      }
    });
  });
});
