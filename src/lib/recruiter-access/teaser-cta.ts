export const VERIFY_VENUE_HREF = "/recruiter/verification";
export const PRICING_HREF = "/recruiter/upgrade";

export type TeaserCtaKind = "verify" | "subscribe";

export interface TeaserCta {
  kind: TeaserCtaKind;
  href: string;
}

/**
 * One unlock action for a locked teaser card.
 * Unverified recruiters verify. Verified recruiters without a plan subscribe.
 * A recruiter never sees both.
 */
export function teaserContactCta(input: {
  isVerified: boolean;
  hasActivePlan: boolean;
}): TeaserCta | null {
  if (!input.isVerified) {
    return { kind: "verify", href: VERIFY_VENUE_HREF };
  }
  if (!input.hasActivePlan) {
    return { kind: "subscribe", href: PRICING_HREF };
  }
  return null;
}

export function teaserPlaceLabel(input: {
  location?: string | null;
  area?: string | null;
}): string | null {
  const city = input.location?.trim() || "";
  const area = input.area?.trim() || "";
  if (city && area && city.toLowerCase() !== area.toLowerCase()) {
    return `${city} · ${area}`;
  }
  return city || area || null;
}
