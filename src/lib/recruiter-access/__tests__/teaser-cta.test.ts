import { describe, expect, it } from "vitest";
import {
  ADD_VENUE_HREF,
  PRICING_HREF,
  VERIFY_IDENTITY_HREF,
  teaserContactCta,
  teaserPlaceLabel,
} from "../teaser-cta";

describe("teaserContactCta", () => {
  it("sends a recruiter who has not verified identity to identity verification", () => {
    expect(
      teaserContactCta({
        isVerified: false,
        identityVerified: false,
        hasActivePlan: false,
      })
    ).toEqual({ kind: "verify", href: VERIFY_IDENTITY_HREF });
    expect(
      teaserContactCta({
        isVerified: false,
        identityVerified: false,
        hasActivePlan: true,
      })
    ).toEqual({ kind: "verify", href: VERIFY_IDENTITY_HREF });
  });

  it("sends an identity-verified recruiter with no approved venue to venues", () => {
    expect(
      teaserContactCta({
        isVerified: false,
        identityVerified: true,
        hasActivePlan: false,
      })
    ).toEqual({ kind: "verify", href: ADD_VENUE_HREF });
    expect(
      teaserContactCta({
        isVerified: false,
        identityVerified: true,
        hasActivePlan: true,
      })
    ).toEqual({ kind: "verify", href: "/recruiter/venues" });
  });

  it("sends a verified recruiter without a plan to pricing only", () => {
    expect(
      teaserContactCta({
        isVerified: true,
        identityVerified: true,
        hasActivePlan: false,
      })
    ).toEqual({ kind: "subscribe", href: PRICING_HREF });
  });

  it("returns no unlock CTA when the recruiter already has a plan", () => {
    expect(
      teaserContactCta({
        isVerified: true,
        identityVerified: true,
        hasActivePlan: true,
      })
    ).toBeNull();
  });

  it("never returns both verify and subscribe", () => {
    const cases = [
      { isVerified: false, identityVerified: false, hasActivePlan: false },
      { isVerified: false, identityVerified: false, hasActivePlan: true },
      { isVerified: false, identityVerified: true, hasActivePlan: false },
      { isVerified: false, identityVerified: true, hasActivePlan: true },
      { isVerified: true, identityVerified: true, hasActivePlan: false },
      { isVerified: true, identityVerified: true, hasActivePlan: true },
    ];
    for (const input of cases) {
      const cta = teaserContactCta(input);
      expect(
        cta === null || cta.kind === "verify" || cta.kind === "subscribe"
      ).toBe(true);
      if (cta?.kind === "verify") {
        expect(cta.href).not.toBe(PRICING_HREF);
      }
      if (cta?.kind === "subscribe") {
        expect(cta.href).not.toBe(VERIFY_IDENTITY_HREF);
        expect(cta.href).not.toBe(ADD_VENUE_HREF);
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
