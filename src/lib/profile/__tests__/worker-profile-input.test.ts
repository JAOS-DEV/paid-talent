import { describe, expect, it } from "vitest";
import {
  parseProfileBio,
  parseProfileContact,
  parseProfileExperience,
  parseProfileLocation,
  parseProfileName,
  parseProfileRoles,
} from "../worker-profile-input";
import { DEFAULT_WORKER_PAY_CURRENCY } from "../limits";
import { PROFANITY_BLOCKED_MESSAGE } from "@/lib/helpers/profanity-filter";
import { CONTACT_CIRCUMVENTION_MESSAGE } from "../public-text";

describe("worker profile input", () => {
  describe("job roles", () => {
    it("accepts Dancer and PR / Promotions", () => {
      const result = parseProfileRoles({
        jobRoles: ["Dancer", "PR / Promotions"],
      });
      expect(result).toEqual({
        ok: true,
        data: { jobRoles: ["Dancer", "PR / Promotions"] },
      });
    });

    it("persists a custom Other role instead of Other", () => {
      const result = parseProfileRoles({
        jobRoles: ["Bartender", "Other"],
        customJobRole: "Model",
      });
      expect(result).toEqual({
        ok: true,
        data: { jobRoles: ["Bartender", "Model"] },
      });
    });

    it("enforces custom role max length server-side", () => {
      const result = parseProfileRoles({
        jobRoles: ["Other"],
        customJobRole: "A".repeat(41),
      });
      expect(result.ok).toBe(false);
    });

    it("rejects an excessive roles payload on a direct call", () => {
      const result = parseProfileRoles({
        jobRoles: Array.from({ length: 20 }, (_, index) => `Role ${index}`),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/up to 8 job roles/);
      }
    });
  });

  describe("experience", () => {
    it("accepts 500 characters and rejects 501", () => {
      expect(
        parseProfileExperience({ experience: "A".repeat(500) }).ok
      ).toBe(true);
      expect(
        parseProfileExperience({ experience: "A".repeat(501) }).ok
      ).toBe(false);
    });

    it("rejects profanity and contact bypasses", () => {
      expect(
        parseProfileExperience({ experience: "fuck off" }).ok
      ).toBe(false);
      expect(
        parseProfileExperience({ experience: "call me 0812345678" }).ok
      ).toBe(false);
      expect(
        parseProfileExperience({ experience: "myname@gmail.com" }).ok
      ).toBe(false);
      expect(
        parseProfileExperience({
          experience: "https://instagram.com/myname",
        }).ok
      ).toBe(false);
    });
  });

  describe("bio", () => {
    it("still requires a minimum length", () => {
      const result = parseProfileBio({ bio: "too short" });
      expect(result.ok).toBe(false);
    });

    it("accepts 500 characters and rejects 501", () => {
      expect(parseProfileBio({ bio: "A".repeat(500) }).ok).toBe(true);
      expect(parseProfileBio({ bio: "A".repeat(501) }).ok).toBe(false);
    });

    it("rejects fuck off cunt", () => {
      const result = parseProfileBio({ bio: "fuck off cunt" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PROFANITY_BLOCKED_MESSAGE);
      }
    });

    it("keeps blocking contact details", () => {
      const result = parseProfileBio({ bio: "LINE: abc123" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(CONTACT_CIRCUMVENTION_MESSAGE);
      }
    });
  });

  describe("availability and currency", () => {
    it("defaults missing currency to THB", () => {
      const result = parseProfileLocation({
        location: "Bangkok",
        availability: ["Full-time"],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.payCurrency).toBe(DEFAULT_WORKER_PAY_CURRENCY);
      }
    });

    it("preserves an explicitly saved currency", () => {
      const result = parseProfileLocation({
        location: "Bangkok",
        availability: ["Part-time"],
        payCurrency: "USD",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.payCurrency).toBe("USD");
      }
    });

    it("accepts multiple availability options", () => {
      const result = parseProfileLocation({
        location: "Pattaya",
        availability: ["Full-time", "Part-time", "Flexible", "On-call"],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.availability).toEqual([
          "Full-time",
          "Part-time",
          "Flexible",
          "On-call",
        ]);
      }
    });

    it("rejects invalid availability options", () => {
      const result = parseProfileLocation({
        location: "Pattaya",
        availability: ["Full-time", "made-up-value"],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("name and contacts", () => {
    it("rejects contact details in display name", () => {
      const result = parseProfileName({ displayName: "IG: myname123" });
      expect(result.ok).toBe(false);
    });

    it("still stores designated contact methods", () => {
      const result = parseProfileContact({
        lineId: "abc123",
        whatsappNumber: "+66812345678",
        phoneNumber: "0812345678",
      });
      expect(result).toEqual({
        ok: true,
        data: {
          lineId: "abc123",
          whatsappNumber: "+66812345678",
          phoneNumber: "0812345678",
        },
      });
    });
  });
});
