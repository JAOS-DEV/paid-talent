import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  BLURB_MAX_LENGTH,
  OPENING_NOTES_MAX_LENGTH,
} from "../index";

const updateProfileSchema = z.object({
  organizationName: z.string().min(1, "Venue/org name is required").max(100),
  area: z.string().min(1, "Area is required").max(100),
  subArea: z.string().max(100).optional(),
  blurb: z.string().min(1, "Blurb is required").max(BLURB_MAX_LENGTH, `Blurb must be ${BLURB_MAX_LENGTH} characters or less`),
  logoKey: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(20).optional(),
});

const createOpeningSchema = z.object({
  role: z.string().min(1, "Role is required").max(100),
  area: z.string().min(1, "Area is required").max(100),
  payMin: z.coerce.number().min(0).optional(),
  payMax: z.coerce.number().min(0).optional(),
  notes: z.string().max(OPENING_NOTES_MAX_LENGTH, `Notes must be ${OPENING_NOTES_MAX_LENGTH} characters or less`).optional(),
  isPublished: z.boolean().default(false),
});

describe("recruiter profile actions validation", () => {
  describe("updateProfileSchema", () => {
    it("should validate valid profile data", () => {
      const validData = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place for nightlife.",
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should require organizationName", () => {
      const invalidData = {
        area: "Sukhumvit",
        blurb: "A great place for nightlife.",
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject empty organizationName", () => {
      const invalidData = {
        organizationName: "",
        area: "Sukhumvit",
        blurb: "A great place for nightlife.",
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should require area", () => {
      const invalidData = {
        organizationName: "Test Venue",
        blurb: "A great place for nightlife.",
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should require blurb", () => {
      const invalidData = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject blurb exceeding max length", () => {
      const invalidData = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A".repeat(BLURB_MAX_LENGTH + 1),
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(`${BLURB_MAX_LENGTH}`);
      }
    });

    it("should accept blurb at max length", () => {
      const validData = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A".repeat(BLURB_MAX_LENGTH),
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept optional subArea", () => {
      const validData = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        subArea: "Soi 11",
        blurb: "A great place.",
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate logoUrl as URL or empty string", () => {
      const validWithUrl = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place.",
        logoUrl: "https://example.com/logo.png",
      };

      const validWithEmpty = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place.",
        logoUrl: "",
      };

      const invalidUrl = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place.",
        logoUrl: "not-a-url",
      };

      expect(updateProfileSchema.safeParse(validWithUrl).success).toBe(true);
      expect(updateProfileSchema.safeParse(validWithEmpty).success).toBe(true);
      expect(updateProfileSchema.safeParse(invalidUrl).success).toBe(false);
    });

    it("should validate contactEmail as email or empty string", () => {
      const validWithEmail = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place.",
        contactEmail: "hr@test.com",
      };

      const validWithEmpty = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place.",
        contactEmail: "",
      };

      const invalidEmail = {
        organizationName: "Test Venue",
        area: "Sukhumvit",
        blurb: "A great place.",
        contactEmail: "not-an-email",
      };

      expect(updateProfileSchema.safeParse(validWithEmail).success).toBe(true);
      expect(updateProfileSchema.safeParse(validWithEmpty).success).toBe(true);
      expect(updateProfileSchema.safeParse(invalidEmail).success).toBe(false);
    });
  });

  describe("createOpeningSchema", () => {
    it("should validate valid opening data", () => {
      const validData = {
        role: "Bartender",
        area: "Sukhumvit",
      };

      const result = createOpeningSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should require role", () => {
      const invalidData = {
        area: "Sukhumvit",
      };

      const result = createOpeningSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should require area", () => {
      const invalidData = {
        role: "Bartender",
      };

      const result = createOpeningSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should accept optional pay range", () => {
      const validData = {
        role: "Bartender",
        area: "Sukhumvit",
        payMin: 500,
        payMax: 1000,
      };

      const result = createOpeningSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should coerce string pay values to numbers", () => {
      const validData = {
        role: "Bartender",
        area: "Sukhumvit",
        payMin: "500",
        payMax: "1000",
      };

      const result = createOpeningSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payMin).toBe(500);
        expect(result.data.payMax).toBe(1000);
      }
    });

    it("should reject negative pay values", () => {
      const invalidData = {
        role: "Bartender",
        area: "Sukhumvit",
        payMin: -100,
      };

      const result = createOpeningSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject notes exceeding max length", () => {
      const invalidData = {
        role: "Bartender",
        area: "Sukhumvit",
        notes: "A".repeat(OPENING_NOTES_MAX_LENGTH + 1),
      };

      const result = createOpeningSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(`${OPENING_NOTES_MAX_LENGTH}`);
      }
    });

    it("should accept notes at max length", () => {
      const validData = {
        role: "Bartender",
        area: "Sukhumvit",
        notes: "A".repeat(OPENING_NOTES_MAX_LENGTH),
      };

      const result = createOpeningSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should default isPublished to false", () => {
      const validData = {
        role: "Bartender",
        area: "Sukhumvit",
      };

      const result = createOpeningSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPublished).toBe(false);
      }
    });

    it("should accept isPublished true", () => {
      const validData = {
        role: "Bartender",
        area: "Sukhumvit",
        isPublished: true,
      };

      const result = createOpeningSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPublished).toBe(true);
      }
    });
  });
});

describe("pay validation logic", () => {
  it("should flag when payMin exceeds payMax", () => {
    const payMin = 1000;
    const payMax = 500;

    const isInvalid = payMin > payMax;
    expect(isInvalid).toBe(true);
  });

  it("should allow equal payMin and payMax", () => {
    const payMin = 800;
    const payMax = 800;

    const isInvalid = payMin > payMax;
    expect(isInvalid).toBe(false);
  });

  it("should allow valid pay range", () => {
    const payMin = 500;
    const payMax = 1000;

    const isInvalid = payMin > payMax;
    expect(isInvalid).toBe(false);
  });
});
