import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  createOpeningSchema,
  updateOpeningSchema,
  updateProfileSchema,
  emptyToUndefined,
  isPayRangeValid,
  normalizeOptionalPay,
  normalizeOptionalText,
  BLURB_MAX_LENGTH,
  OPENING_NOTES_MAX_LENGTH,
} from "../index";

describe("recruiter opening/profile validation (behavioural)", () => {
  describe("empty optional form values", () => {
    it("emptyToUndefined maps empty string/null/undefined to undefined", () => {
      expect(emptyToUndefined("")).toBeUndefined();
      expect(emptyToUndefined(null)).toBeUndefined();
      expect(emptyToUndefined(undefined)).toBeUndefined();
      expect(emptyToUndefined("500")).toBe("500");
      expect(emptyToUndefined(0)).toBe(0);
    });

    it("does not coerce empty pay fields to zero", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payMin: "",
        payMax: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payMin).toBeUndefined();
        expect(result.data.payMax).toBeUndefined();
        expect(normalizeOptionalPay(result.data.payMin)).toBeNull();
        expect(normalizeOptionalPay(result.data.payMax)).toBeNull();
      }
    });

    it("normalizes empty notes to null rather than empty string", () => {
      expect(normalizeOptionalText("")).toBeNull();
      expect(normalizeOptionalText("   ")).toBeNull();
      expect(normalizeOptionalText(" Weekend only ")).toBe("Weekend only");
    });
  });

  describe("pay constraints", () => {
    it("rejects negative payMin and payMax", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payMin: -1,
        }).success
      ).toBe(false);

      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payMax: -5,
        }).success
      ).toBe(false);
    });

    it("allows zero pay", () => {
      const result = createOpeningSchema.safeParse({
        role: "Intern",
        area: "Sukhumvit",
        payMin: 0,
        payMax: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects payMin > payMax when both exist", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payMin: 1000,
        payMax: 500,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "Minimum pay cannot exceed maximum pay"
        );
      }
      expect(isPayRangeValid(1000, 500)).toBe(false);
    });

    it("allows payMin <= payMax and single-sided pay", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payMin: 500,
          payMax: 1000,
        }).success
      ).toBe(true);
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payMin: 500,
        }).success
      ).toBe(true);
      expect(isPayRangeValid(500, undefined)).toBe(true);
      expect(isPayRangeValid(null, 1000)).toBe(true);
    });

    it("coerces numeric strings for form inputs", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payMin: "500",
        payMax: "1000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payMin).toBe(500);
        expect(result.data.payMax).toBe(1000);
      }
    });
  });

  describe("text limits and trimming", () => {
    it("trims required role/area and rejects blank after trim", () => {
      const trimmed = createOpeningSchema.safeParse({
        role: "  Bartender  ",
        area: "  Sukhumvit ",
      });
      expect(trimmed.success).toBe(true);
      if (trimmed.success) {
        expect(trimmed.data.role).toBe("Bartender");
        expect(trimmed.data.area).toBe("Sukhumvit");
      }

      expect(
        createOpeningSchema.safeParse({
          role: "   ",
          area: "Sukhumvit",
        }).success
      ).toBe(false);
    });

    it("enforces blurb max 240 and notes max 500", () => {
      expect(
        updateProfileSchema.safeParse({
          organizationName: "Venue",
          area: "Sukhumvit",
          blurb: "A".repeat(BLURB_MAX_LENGTH + 1),
        }).success
      ).toBe(false);

      expect(
        updateProfileSchema.safeParse({
          organizationName: "Venue",
          area: "Sukhumvit",
          blurb: "A".repeat(BLURB_MAX_LENGTH),
        }).success
      ).toBe(true);

      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          notes: "A".repeat(OPENING_NOTES_MAX_LENGTH + 1),
        }).success
      ).toBe(false);

      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          notes: "A".repeat(OPENING_NOTES_MAX_LENGTH),
        }).success
      ).toBe(true);
    });

    it("requires uuid id for updateOpening and defaults isPublished false", () => {
      expect(
        updateOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
        }).success
      ).toBe(false);

      const created = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
      });
      expect(created.success).toBe(true);
      if (created.success) {
        expect(created.data.isPublished).toBe(false);
      }
    });
  });
});

describe("ownership mutation invariants (documented in actions)", () => {
  it("update/delete/publish paths must scope by recruiterProfileId", () => {
    const actionsSource = readFileSync(
      join(__dirname, "../actions.ts"),
      "utf8"
    );

    expect(actionsSource).toContain(
      "eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)"
    );
    expect(actionsSource).toMatch(/deleteOpening[\s\S]*and\(/);
    expect(actionsSource).toMatch(
      /\.delete\(recruiterOpenings\)[\s\S]*recruiterProfileId/
    );
    expect(actionsSource).toMatch(
      /\.update\(recruiterOpenings\)[\s\S]*recruiterProfileId/
    );
  });
});
