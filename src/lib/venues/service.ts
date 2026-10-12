import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import { db, recruiterProfiles, venues } from "@/lib/db";
import type { Venue, VenueLinkKind } from "@/lib/db/schema";
import { getEffectiveEntitlement } from "@/lib/entitlements";
import { getFreeMaxVenues, getPaidMaxVenues } from "./limits";
import { parseVenueLink } from "./link";

export type VenueServiceError = {
  ok: false;
  error: string;
  status: 400 | 403 | 404 | 409;
};

export type VenueServiceSuccess<T> = { ok: true; data: T };

export type VenueWriteInput = {
  name: string;
  venueType?: string | null;
  area?: string | null;
  subArea?: string | null;
  blurb?: string | null;
  venueLinkUrl: string;
  isPrimary?: boolean;
};

function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function getMaxVenues(userId: string): Promise<number> {
  const entitlement = await getEffectiveEntitlement(userId);
  // open_access alone does NOT raise the limit — only paid or admin grant.
  if (entitlement.paidAccess || entitlement.adminGrantAccess) {
    return getPaidMaxVenues();
  }
  return getFreeMaxVenues();
}

export async function listVenues(
  recruiterProfileId: string,
  options: { includeArchived?: boolean } = {}
): Promise<Venue[]> {
  if (options.includeArchived) {
    return db
      .select()
      .from(venues)
      .where(eq(venues.recruiterProfileId, recruiterProfileId))
      .orderBy(asc(venues.createdAt));
  }

  return db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.recruiterProfileId, recruiterProfileId),
        isNull(venues.archivedAt)
      )
    )
    .orderBy(asc(venues.createdAt));
}

async function countActiveVenues(recruiterProfileId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(venues)
    .where(
      and(
        eq(venues.recruiterProfileId, recruiterProfileId),
        isNull(venues.archivedAt)
      )
    );
  return Number(row?.value ?? 0);
}

async function getRecruiterUserId(
  recruiterProfileId: string
): Promise<string | null> {
  const [profile] = await db
    .select({ userId: recruiterProfiles.userId })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.id, recruiterProfileId))
    .limit(1);
  return profile?.userId ?? null;
}

async function clearOtherPrimaries(
  recruiterProfileId: string,
  exceptVenueId?: string
): Promise<void> {
  const conditions = [
    eq(venues.recruiterProfileId, recruiterProfileId),
    eq(venues.isPrimary, true),
  ];
  if (exceptVenueId) {
    conditions.push(ne(venues.id, exceptVenueId));
  }
  await db
    .update(venues)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(...conditions));
}

export async function createVenue(
  recruiterProfileId: string,
  input: VenueWriteInput
): Promise<VenueServiceSuccess<Venue> | VenueServiceError> {
  const userId = await getRecruiterUserId(recruiterProfileId);
  if (!userId) {
    return { ok: false, error: "Recruiter profile not found", status: 404 };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Venue name is required", status: 400 };
  }

  const link = parseVenueLink(input.venueLinkUrl);
  if (!link.ok) {
    return { ok: false, error: link.error, status: 400 };
  }

  const maxVenues = await getMaxVenues(userId);
  const activeCount = await countActiveVenues(recruiterProfileId);
  if (activeCount >= maxVenues) {
    return {
      ok: false,
      error: `You can have at most ${maxVenues} venue${maxVenues === 1 ? "" : "s"} on your current plan`,
      status: 400,
    };
  }

  const makePrimary = input.isPrimary === true || activeCount === 0;
  if (makePrimary) {
    await clearOtherPrimaries(recruiterProfileId);
  }

  const now = new Date();
  const [created] = await db
    .insert(venues)
    .values({
      recruiterProfileId,
      name,
      venueType: normalizeOptionalText(input.venueType),
      area: normalizeOptionalText(input.area),
      subArea: normalizeOptionalText(input.subArea),
      blurb: normalizeOptionalText(input.blurb),
      venueLinkUrl: link.normalizedUrl,
      venueLinkKind: link.kind,
      reviewStatus: "pending",
      isPrimary: makePrimary,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return { ok: true, data: created };
}

export async function updateVenue(
  venueId: string,
  recruiterProfileId: string,
  input: VenueWriteInput
): Promise<VenueServiceSuccess<Venue> | VenueServiceError> {
  const [existing] = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.id, venueId),
        eq(venues.recruiterProfileId, recruiterProfileId),
        isNull(venues.archivedAt)
      )
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Venue not found", status: 404 };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Venue name is required", status: 400 };
  }

  const link = parseVenueLink(input.venueLinkUrl);
  if (!link.ok) {
    return { ok: false, error: link.error, status: 400 };
  }

  const linkChanged =
    existing.venueLinkUrl !== link.normalizedUrl ||
    existing.venueLinkKind !== link.kind;

  const now = new Date();
  const [updated] = await db
    .update(venues)
    .set({
      name,
      venueType: normalizeOptionalText(input.venueType),
      area: normalizeOptionalText(input.area),
      subArea: normalizeOptionalText(input.subArea),
      blurb: normalizeOptionalText(input.blurb),
      venueLinkUrl: link.normalizedUrl,
      venueLinkKind: link.kind,
      ...(linkChanged
        ? {
            reviewStatus: "pending" as const,
            reviewNote: null,
            reviewedAt: null,
            reviewedBy: null,
          }
        : {}),
      updatedAt: now,
    })
    .where(eq(venues.id, venueId))
    .returning();

  if (input.isPrimary === true && !existing.isPrimary) {
    return setPrimary(venueId, recruiterProfileId);
  }

  return { ok: true, data: updated };
}

export async function archiveVenue(
  venueId: string,
  recruiterProfileId: string
): Promise<VenueServiceSuccess<Venue> | VenueServiceError> {
  const [existing] = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.id, venueId),
        eq(venues.recruiterProfileId, recruiterProfileId),
        isNull(venues.archivedAt)
      )
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Venue not found", status: 404 };
  }

  const activeCount = await countActiveVenues(recruiterProfileId);
  if (activeCount <= 1) {
    return {
      ok: false,
      error: "You must keep at least one active venue",
      status: 400,
    };
  }

  const now = new Date();
  const [archived] = await db
    .update(venues)
    .set({
      archivedAt: now,
      isPrimary: false,
      updatedAt: now,
    })
    .where(eq(venues.id, venueId))
    .returning();

  if (existing.isPrimary) {
    const [nextPrimary] = await db
      .select()
      .from(venues)
      .where(
        and(
          eq(venues.recruiterProfileId, recruiterProfileId),
          isNull(venues.archivedAt),
          ne(venues.id, venueId)
        )
      )
      .orderBy(asc(venues.createdAt))
      .limit(1);

    if (nextPrimary) {
      await db
        .update(venues)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(venues.id, nextPrimary.id));
    }
  }

  return { ok: true, data: archived };
}

export async function setPrimary(
  venueId: string,
  recruiterProfileId: string
): Promise<VenueServiceSuccess<Venue> | VenueServiceError> {
  const [existing] = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.id, venueId),
        eq(venues.recruiterProfileId, recruiterProfileId),
        isNull(venues.archivedAt)
      )
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Venue not found", status: 404 };
  }

  await clearOtherPrimaries(recruiterProfileId, venueId);

  const [updated] = await db
    .update(venues)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(eq(venues.id, venueId))
    .returning();

  return { ok: true, data: updated };
}

export async function getVenueOwnedByRecruiter(
  venueId: string,
  recruiterProfileId: string
): Promise<Venue | null> {
  const [venue] = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.id, venueId),
        eq(venues.recruiterProfileId, recruiterProfileId),
        isNull(venues.archivedAt)
      )
    )
    .limit(1);
  return venue ?? null;
}

export async function getPrimaryVenue(
  recruiterProfileId: string
): Promise<Venue | null> {
  const [venue] = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.recruiterProfileId, recruiterProfileId),
        eq(venues.isPrimary, true),
        isNull(venues.archivedAt)
      )
    )
    .limit(1);
  return venue ?? null;
}

export function inferVenueLinkKindFromWebsite(
  website: string | null | undefined
): VenueLinkKind {
  const value = (website ?? "").toLowerCase();
  if (
    (value.includes("google.") && value.includes("/maps")) ||
    value.includes("maps.app.goo.gl")
  ) {
    return "google_maps";
  }
  if (value.includes("facebook.com") || value.includes("fb.com")) {
    return "facebook";
  }
  if (value.includes("instagram.com")) {
    return "instagram";
  }
  return "google_maps";
}
