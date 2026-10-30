import { describe, expect, it } from "vitest";
import {
  PRICING_HREF,
  VERIFY_VENUE_HREF,
  teaserContactCta,
  teaserPlaceLabel,
} from "../teaser-cta";

describe("teaserContactCta", () => {
  it("sends an unverified recruiter to venue verification only", () => {
    expect(
      teaserContactCta({ isVerified: false, hasActivePlan: false })
    ).toEqual({ kind: "verify", href: VERIFY_VENUE_HREF });
    expect(
      teaserContactCta({ isVerified: false, hasActivePlan: true })
    ).toEqual({ kind: "verify", href: VERIFY_VENUE_HREF });
  });

  it("sends a verified recruiter without a plan to pricing only", () => {
    expect(
      teaserContactCta({ isVerified: true, hasActivePlan: false })
    ).toEqual({ kind: "subscribe", href: PRICING_HREF });
  });

  it("returns no unlock CTA when the recruiter already has a plan", () => {
    expect(
      teaserContactCta({ isVerified: true, hasActivePlan: true })
    ).toBeNull();
  });

  it("never returns both verify and subscribe", () => {
    const cases = [
      { isVerified: false, hasActivePlan: false },
      { isVerified: false, hasActivePlan: true },
      { isVerified: true, hasActivePlan: false },
      { isVerified: true, hasActivePlan: true },
    ];
    for (const input of cases) {
      const cta = teaserContactCta(input);
      expect(cta === null || cta.kind === "verify" || cta.kind === "subscribe").toBe(
        true
      );
      if (cta?.kind === "verify") {
        expect(cta.href).not.toBe(PRICING_HREF);
      }
      if (cta?.kind === "subscribe") {
        expect(cta.href).not.toBe(VERIFY_VENUE_HREF);
      }
    }
  });
});

describe("teaserPlaceLabel", () => {
  it("joins city and area when they differ", () => {
    expect(teaserPlaceLabel({ location: "Bangkok", area: "Sukhumvit" })).toBe(
      "Bangkok · Sukhumvit"
    );
  });

  it("uses a single place when city and area match", () => {
    expect(teaserPlaceLabel({ location: "Pattaya", area: "Pattaya" })).toBe(
      "Pattaya"
    );
    expect(teaserPlaceLabel({ location: null, area: "Phuket" })).toBe("Phuket");
  });
});
