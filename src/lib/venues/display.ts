import { and, eq, isNull } from "drizzle-orm";
import { db, recruiterOpenings, recruiterProfiles, venues } from "@/lib/db";
import type { VenueLinkKind, VenueReviewStatus } from "@/lib/db/schema";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import { venueLinkKindLabel } from "./link";

export interface ResolvedVenueDisplay {
  venueId: string | null;
  venueName: string | null;
  logoUrl: string | null;
  area: string | null;
  subArea: string | null;
  blurb: string | null;
  venueLinkUrl: string | null;
  venueLinkKind: VenueLinkKind | null;
  reviewStatus: VenueReviewStatus | null;
  /** Public external link only when admin-approved. */
  publicVenueLinkUrl: string | null;
  publicVenueLinkLabel: string | null;
}

function publicLinkFields(
  reviewStatus: VenueReviewStatus | null | undefined,
  venueLinkUrl: string | null | undefined,
  venueLinkKind: VenueLinkKind | null | undefined
): Pick<ResolvedVenueDisplay, "publicVenueLinkUrl" | "publicVenueLinkLabel"> {
  if (
    reviewStatus === "approved" &&
    venueLinkUrl &&
    venueLinkKind
  ) {
    return {
      publicVenueLinkUrl: venueLinkUrl,
      publicVenueLinkLabel: `View venue on ${venueLinkKindLabel(venueLinkKind)}`,
    };
  }
  return { publicVenueLinkUrl: null, publicVenueLinkLabel: null };
}

/**
 * Prefer opening venue → primary venue → legacy recruiter_profiles fields.
 */
export async function resolveVenueDisplayForRecruiter(input: {
  recruiterUserId: string;
  openingId?: string | null;
}): Promise<ResolvedVenueDisplay | null> {
  const [profile] = await db
    .select({
      id: recruiterProfiles.id,
      organizationName: recruiterProfiles.organizationName,
      logoUrl: recruiterProfiles.logoUrl,
      area: recruiterProfiles.area,
      subArea: recruiterProfiles.subArea,
      blurb: recruiterProfiles.blurb,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, input.recruiterUserId))
    .limit(1);

  if (!profile) {
    return null;
  }

  let venueRow: {
    id: string;
    name: string;
    logoUrl: string | null;
    area: string | null;
    subArea: string | null;
    blurb: string | null;
    venueLinkUrl: string;
    venueLinkKind: VenueLinkKind;
    reviewStatus: VenueReviewStatus;
  } | null = null;

  if (input.openingId) {
    const [opening] = await db
      .select({ venueId: recruiterOpenings.venueId })
      .from(recruiterOpenings)
      .where(eq(recruiterOpenings.id, input.openingId))
      .limit(1);

    if (opening?.venueId) {
      const [openingVenue] = await db
        .select({
          id: venues.id,
          name: venues.name,
          logoUrl: venues.logoUrl,
          area: venues.area,
          subArea: venues.subArea,
          blurb: venues.blurb,
          venueLinkUrl: venues.venueLinkUrl,
          venueLinkKind: venues.venueLinkKind,
          reviewStatus: venues.reviewStatus,
        })
        .from(venues)
        .where(
          and(eq(venues.id, opening.venueId), isNull(venues.archivedAt))
        )
        .limit(1);
      venueRow = openingVenue ?? null;
    }
  }

  if (!venueRow) {
    const [primary] = await db
      .select({
        id: venues.id,
        name: venues.name,
        logoUrl: venues.logoUrl,
        area: venues.area,
        subArea: venues.subArea,
        blurb: venues.blurb,
        venueLinkUrl: venues.venueLinkUrl,
        venueLinkKind: venues.venueLinkKind,
        reviewStatus: venues.reviewStatus,
      })
      .from(venues)
      .where(
        and(
          eq(venues.recruiterProfileId, profile.id),
          eq(venues.isPrimary, true),
          isNull(venues.archivedAt)
        )
      )
      .limit(1);
    venueRow = primary ?? null;
  }

  if (venueRow) {
    const link = publicLinkFields(
      venueRow.reviewStatus,
      venueRow.venueLinkUrl,
      venueRow.venueLinkKind
    );
    return {
      venueId: venueRow.id,
      venueName: venueRow.name,
      logoUrl: toPublicVenueLogoUrl(venueRow.logoUrl ?? profile.logoUrl),
      area: venueRow.area ?? profile.area,
      subArea: venueRow.subArea ?? profile.subArea,
      blurb: venueRow.blurb ?? profile.blurb,
      venueLinkUrl: venueRow.venueLinkUrl,
      venueLinkKind: venueRow.venueLinkKind,
      reviewStatus: venueRow.reviewStatus,
      ...link,
    };
  }

  return {
    venueId: null,
    venueName: profile.organizationName,
    logoUrl: toPublicVenueLogoUrl(profile.logoUrl),
    area: profile.area,
    subArea: profile.subArea,
    blurb: profile.blurb,
    venueLinkUrl: null,
    venueLinkKind: null,
    reviewStatus: null,
    publicVenueLinkUrl: null,
    publicVenueLinkLabel: null,
  };
}
