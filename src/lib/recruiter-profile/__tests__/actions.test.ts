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
  toOpeningPayStorage,
  OPENING_PAY_AMOUNT_MAX,
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

    it("does not coerce empty pay to zero and keeps pay optional", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payAmount: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payAmount).toBeUndefined();
        expect(normalizeOptionalPay(result.data.payAmount)).toBeNull();
        expect(toOpeningPayStorage(normalizeOptionalPay(result.data.payAmount))).toEqual({
          payMin: null,
          payMax: null,
        });
      }
    });

    it("normalizes empty notes to null rather than empty string", () => {
      expect(normalizeOptionalText("")).toBeNull();
      expect(normalizeOptionalText("   ")).toBeNull();
      expect(normalizeOptionalText(" Weekend only ")).toBe("Weekend only");
    });
  });

  describe("single advertised pay", () => {
    it("rejects negative pay", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payAmount: -1,
        }).success
      ).toBe(false);
    });

    it("allows zero pay", () => {
      const result = createOpeningSchema.safeParse({
        role: "Intern",
        area: "Sukhumvit",
        payAmount: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(toOpeningPayStorage(result.data.payAmount ?? null)).toEqual({
          payMin: 0,
          payMax: null,
        });
      }
    });

    it("stores one amount as payMin with payMax null", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payAmount: 1200,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payAmount).toBe(1200);
        expect(toOpeningPayStorage(result.data.payAmount ?? null)).toEqual({
          payMin: 1200,
          payMax: null,
        });
      }
    });

    it("coerces numeric strings for form inputs", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payAmount: "500",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payAmount).toBe(500);
      }
    });

    it("rejects non-finite and oversized pay", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payAmount: Number.POSITIVE_INFINITY,
        }).success
      ).toBe(false);
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payAmount: OPENING_PAY_AMOUNT_MAX + 1,
        }).success
      ).toBe(false);
    });

    it("keeps isPayRangeValid for legacy stored rows", () => {
      expect(isPayRangeValid(1000, 500)).toBe(false);
      expect(isPayRangeValid(500, undefined)).toBe(true);
      expect(isPayRangeValid(null, 1000)).toBe(true);
    });
  });

  describe("currency and pay period", () => {
    it("defaults new openings to THB and night", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payCurrency).toBe("THB");
        expect(result.data.payPeriod).toBe("night");
      }
    });

    it("persists allowlisted currencies including USD", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payCurrency: "USD",
        payPeriod: "hour",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payCurrency).toBe("USD");
        expect(result.data.payPeriod).toBe("hour");
      }
    });

    it("rejects arbitrary currency strings", () => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payCurrency: "lol",
      });
      expect(result.success).toBe(false);
    });

    it.each(["night", "hour", "shift"])("accepts pay period %s", (payPeriod) => {
      const result = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payPeriod,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payPeriod).toBe(payPeriod);
      }
    });

    it("rejects invalid pay periods", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payPeriod: "day",
        }).success
      ).toBe(false);
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payPeriod: "week",
        }).success
      ).toBe(false);
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payPeriod: "<script>alert(1)</script>",
        }).success
      ).toBe(false);
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

    it("enforces role/area max 100 and notes max 500", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "A".repeat(101),
          area: "Sukhumvit",
        }).success
      ).toBe(false);
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "A".repeat(101),
        }).success
      ).toBe(false);
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
    expect(actionsSource).toContain("Opening not found or unauthorized");
    expect(actionsSource).toContain("requireActiveRecruiter");
  });

  it("create/update persist payAmount via payMin storage plus currency and period", () => {
    const actionsSource = readFileSync(
      join(__dirname, "../actions.ts"),
      "utf8"
    );
    expect(actionsSource).toContain("toOpeningPayStorage");
    expect(actionsSource).toContain("payCurrency");
    expect(actionsSource).toContain("payPeriod");
    expect(actionsSource).toContain("hasLegacyPayRange");
    expect(actionsSource).not.toContain("normalizeOptionalPay(payMin)");
  });
});
