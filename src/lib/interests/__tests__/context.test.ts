import { describe, it, expect } from "vitest";
import {
  EMPTY_STATE_COPY,
  type InterestContextForWorker,
  type RecruiterDisplayContext,
  type OpeningTag,
  type RecruiterVenueInfo,
} from "../index";

describe("interest context types", () => {
  describe("InterestContextForWorker shape", () => {
    it("should have correct structure with all fields", () => {
      const context: InterestContextForWorker = {
        interestId: "test-interest-id",
        recruiter: {
          recruiterUserId: "test-recruiter-id",
          displayName: "Test Recruiter",
          venueName: "Test Venue",
          logoUrl: "https://example.com/logo.png",
          area: "Sukhumvit",
          subArea: "Soi 11",
          blurbSnippet: "A great venue for nightlife.",
        },
        opening: {
          openingId: "test-opening-id",
          role: "Bartender",
          area: "Sukhumvit",
          payMin: 500,
          payMax: 1000,
          payCurrency: "THB",
          payPeriod: "night",
        },
        message: "We're interested in you!",
        createdAt: new Date(),
      };

      expect(context.interestId).toBe("test-interest-id");
      expect(context.recruiter.venueName).toBe("Test Venue");
      expect(context.opening?.role).toBe("Bartender");
      expect(context.opening?.payMin).toBe(500);
      expect(context.opening?.payMax).toBe(1000);
    });

    it("should allow null opening for interests without opening tag", () => {
      const context: InterestContextForWorker = {
        interestId: "test-interest-id",
        recruiter: {
          recruiterUserId: "test-recruiter-id",
          displayName: "Test Recruiter",
          venueName: "Test Venue",
          logoUrl: null,
          area: "Walking Street",
          subArea: null,
          blurbSnippet: null,
        },
        opening: null,
        message: null,
        createdAt: new Date(),
      };

      expect(context.opening).toBeNull();
      expect(context.recruiter.logoUrl).toBeNull();
      expect(context.recruiter.subArea).toBeNull();
    });

    it("should allow null pay range in opening", () => {
      const opening: OpeningTag = {
        openingId: "test-opening-id",
        role: "Server",
        area: "Thonglor",
        payMin: null,
        payMax: null,
        payCurrency: "THB",
        payPeriod: "night",
      };

      expect(opening.payMin).toBeNull();
      expect(opening.payMax).toBeNull();
      expect(opening.payCurrency).toBe("THB");
    });
  });

  describe("RecruiterDisplayContext shape", () => {
    it("should have all required fields for worker display", () => {
      const display: RecruiterDisplayContext = {
        recruiterUserId: "recruiter-123",
        displayName: "John Smith",
        venueName: "Sky Bar",
        logoUrl: "https://example.com/skybar.png",
        area: "Sukhumvit",
        subArea: "Soi 11",
        blurbSnippet: "Rooftop bar with amazing views...",
      };

      expect(display.recruiterUserId).toBeDefined();
      expect(display.displayName).toBe("John Smith");
      expect(display.venueName).toBe("Sky Bar");
    });

    it("should support minimal display context", () => {
      const display: RecruiterDisplayContext = {
        recruiterUserId: "recruiter-456",
        displayName: null,
        venueName: null,
        logoUrl: null,
        area: null,
        subArea: null,
        blurbSnippet: null,
      };

      expect(display.displayName).toBeNull();
      expect(display.venueName).toBeNull();
    });
  });

  describe("RecruiterVenueInfo shape", () => {
    it("should include full blurb and openings list", () => {
      const venueInfo: RecruiterVenueInfo = {
        recruiterUserId: "recruiter-789",
        displayName: "Pro Recruiter",
        venueName: "Luxury Venues Group",
        logoUrl: "https://example.com/luxury.png",
        area: "Sukhumvit",
        subArea: "Soi 11",
        blurb: "Award-winning hospitality group with rooftop bars, fine dining, and nightclubs across Bangkok.",
        openings: [
          {
            openingId: "opening-1",
            role: "Hostess",
            area: "Sukhumvit",
            payMin: 800,
            payMax: 1500,
            payCurrency: "THB",
            payPeriod: "night",
          },
          {
            openingId: "opening-2",
            role: "Bartender",
            area: "Thonglor",
            payMin: 700,
            payMax: 1200,
            payCurrency: "THB",
            payPeriod: "night",
          },
        ],
      };

      expect(venueInfo.blurb).toContain("Award-winning");
      expect(venueInfo.openings).toHaveLength(2);
      expect(venueInfo.openings[0].role).toBe("Hostess");
    });

    it("should support empty openings list", () => {
      const venueInfo: RecruiterVenueInfo = {
        recruiterUserId: "recruiter-new",
        displayName: "New Recruiter",
        venueName: "New Bar",
        logoUrl: null,
        area: "Pattaya",
        subArea: null,
        blurb: "Just opened!",
        openings: [],
      };

      expect(venueInfo.openings).toHaveLength(0);
    });
  });

  describe("OpeningTag shape", () => {
    it("should contain pay information visible to workers", () => {
      const opening: OpeningTag = {
        openingId: "opening-123",
        role: "DJ",
        area: "Walking Street",
        payMin: 1000,
        payMax: 2000,
        payCurrency: "THB",
        payPeriod: "night",
      };

      expect(opening.payMin).toBe(1000);
      expect(opening.payMax).toBe(2000);
      expect(opening.payCurrency).toBe("THB");
      expect(opening.payPeriod).toBe("night");
    });
  });
});

describe("EMPTY_STATE_COPY", () => {
  it("should have recruiter empty state for no openings", () => {
    expect(EMPTY_STATE_COPY.recruiterNoOpenings).toBe("No openings yet");
    expect(EMPTY_STATE_COPY.recruiterNoOpeningsCta).toBe("Add openings to start hiring");
  });

  it("should have worker empty state for no openings at venue", () => {
    expect(EMPTY_STATE_COPY.workerNoOpenings).toBe("No openings at this venue right now");
  });

  it("should have worker empty state for no interests", () => {
    expect(EMPTY_STATE_COPY.workerNoInterests).toBe("No interest yet — keep your profile fresh");
  });
});
