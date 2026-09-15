import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { formatOpeningPay, emptyPayToNull } from "../format-pay";
import {
  createOpeningSchema,
  updateProfileSchema,
  BLURB_MAX_LENGTH,
  OPENING_NOTES_MAX_LENGTH,
  getRecruiterProfileCompleteness,
} from "@/lib/recruiter-profile";
import type { RecruiterProfile } from "@/lib/db/schema";

function mockProfile(
  overrides: Partial<RecruiterProfile> = {}
): RecruiterProfile {
  return {
    id: "p1",
    userId: "u1",
    organizationName: null,
    organizationType: null,
    website: null,
    description: null,
    location: null,
    contactEmail: null,
    contactPhone: null,
    logoKey: null,
    logoUrl: null,
    area: null,
    subArea: null,
    blurb: null,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("recruiter UI helpers", () => {
  describe("formatOpeningPay", () => {
    it("formats a single advertised amount as THB / night", () => {
      expect(
        formatOpeningPay({ payMin: 1200, payMax: null, payPeriod: "night" })
      ).toBe("1,200 THB / night");
    });

    it("formats a leftover legacy range until it is edited", () => {
      expect(
        formatOpeningPay({ payMin: 500, payMax: 1000 })
      ).toBe("500 – 1,000 THB / night");
    });

    it("returns null when no pay", () => {
      expect(formatOpeningPay({ payMin: null, payMax: null })).toBeNull();
    });
  });

  describe("emptyPayToNull", () => {
    it("keeps blank pay as undefined (not zero)", () => {
      expect(emptyPayToNull("")).toBeUndefined();
      expect(emptyPayToNull("   ")).toBeUndefined();
      expect(emptyPayToNull("800")).toBe(800);
    });
  });

  describe("profile form validation", () => {
    it("requires venue, area, and blurb", () => {
      expect(
        updateProfileSchema.safeParse({
          organizationName: "",
          area: "Sukhumvit",
          blurb: "Hello",
        }).success
      ).toBe(false);

      expect(
        updateProfileSchema.safeParse({
          organizationName: "Sky Bar",
          area: "Sukhumvit",
          blurb: "A".repeat(BLURB_MAX_LENGTH + 1),
        }).success
      ).toBe(false);

      expect(
        updateProfileSchema.safeParse({
          organizationName: "Sky Bar",
          area: "Sukhumvit",
          blurb: "Great venue",
          subArea: "",
          contactEmail: "",
        }).success
      ).toBe(true);
    });

    it("exposes missing required steps for completeness UI", () => {
      const incomplete = getRecruiterProfileCompleteness(mockProfile());
      expect(incomplete.isComplete).toBe(false);
      expect(incomplete.completedSteps).not.toContain("venue");
      expect(incomplete.completedSteps).not.toContain("area");
      expect(incomplete.completedSteps).not.toContain("blurb");

      const complete = getRecruiterProfileCompleteness(
        mockProfile({
          organizationName: "Venue",
          area: "Sukhumvit",
          blurb: "About us",
        })
      );
      expect(complete.isComplete).toBe(true);
    });
  });

  describe("opening form validation", () => {
    it("creates draft and published payloads", () => {
      const draft = createOpeningSchema.safeParse({
        role: "Bartender",
        area: "Sukhumvit",
        payAmount: "",
      });
      expect(draft.success).toBe(true);
      if (draft.success) {
        expect(draft.data.isPublished).toBe(false);
        expect(draft.data.payAmount).toBeUndefined();
        expect(draft.data.payCurrency).toBe("THB");
        expect(draft.data.payPeriod).toBe("night");
      }

      const published = createOpeningSchema.safeParse({
        role: "Hostess",
        area: "Thonglor",
        payAmount: 800,
        payCurrency: "USD",
        payPeriod: "week",
        isPublished: true,
      });
      expect(published.success).toBe(true);
      if (published.success) {
        expect(published.data.isPublished).toBe(true);
        expect(published.data.payAmount).toBe(800);
        expect(published.data.payCurrency).toBe("USD");
      }
    });

    it("rejects invalid pay, currency, period, and overlong notes", () => {
      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payAmount: -5,
        }).success
      ).toBe(false);

      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          payCurrency: "lol",
        }).success
      ).toBe(false);

      expect(
        createOpeningSchema.safeParse({
          role: "Bartender",
          area: "Sukhumvit",
          notes: "x".repeat(OPENING_NOTES_MAX_LENGTH + 1),
        }).success
      ).toBe(false);
    });
  });

  describe("interest opening choices", () => {
    it("only published openings are selectable choices", () => {
      const openings = [
        { id: "1", role: "Bartender", area: "A", isPublished: true },
        { id: "2", role: "DJ", area: "B", isPublished: false },
      ];
      const choices = openings.filter((o) => o.isPublished);
      expect(choices).toHaveLength(1);
      expect(choices[0].id).toBe("1");
    });

    it("general interest uses null openingId", () => {
      const selectedOpeningId = "";
      const body = {
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        openingId: selectedOpeningId || null,
      };
      expect(body.openingId).toBeNull();
    });

    it("selected opening submits openingId", () => {
      const selectedOpeningId = "123e4567-e89b-12d3-a456-426614174001";
      const body = {
        workerProfileId: "123e4567-e89b-12d3-a456-426614174000",
        openingId: selectedOpeningId || null,
      };
      expect(body.openingId).toBe(selectedOpeningId);
    });
  });
});

describe("recruiter UI routes", () => {
  it("documents recruiter profile and openings routes", () => {
    const routes = [
      "/recruiter/profile",
      "/recruiter/openings",
      "/recruiter/openings/new",
      "/recruiter/openings/[id]/edit",
    ];
    expect(routes).toContain("/recruiter/profile");
    expect(routes).toContain("/recruiter/openings/new");
  });

  it("adds Back to Dashboard on venue profile and openings list", () => {
    const profileSource = readFileSync(
      join(__dirname, "../../../app/recruiter/profile/page.tsx"),
      "utf8"
    );
    const openingsSource = readFileSync(
      join(__dirname, "../../../app/recruiter/openings/page.tsx"),
      "utf8"
    );

    expect(profileSource).toContain('href="/recruiter/dashboard"');
    expect(profileSource).toContain("Back to Dashboard");
    expect(openingsSource).toContain('href="/recruiter/dashboard"');
    expect(openingsSource).toContain("Back to Dashboard");
  });

  it("keeps Back to openings on new and edit opening pages", () => {
    const newSource = readFileSync(
      join(__dirname, "../../../app/recruiter/openings/new/page.tsx"),
      "utf8"
    );
    const editSource = readFileSync(
      join(__dirname, "../../../app/recruiter/openings/[id]/edit/page.tsx"),
      "utf8"
    );

    expect(newSource).toContain('href="/recruiter/openings"');
    expect(newSource).toContain("Back to openings");
    expect(editSource).toContain('href="/recruiter/openings"');
    expect(editSource).toContain("Back to openings");
  });
});
