import { and, eq, isNull } from "drizzle-orm";
import { db, venues, recruiterProfiles, users } from "@/lib/db";
import type { Venue, VenueReviewStatus } from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

export type VenueReviewAction = "approve" | "reject";

export type VenueReviewResult =
  | { ok: true; venue: Venue; action: VenueReviewAction }
  | {
      ok: false;
      status: 400 | 404;
      error: string;
      reason?: string;
    };

export async function reviewVenue(input: {
  venueId: string;
  action: VenueReviewAction;
  note?: string | null;
  admin: { userId: string; email: string };
}): Promise<VenueReviewResult> {
  const [existing] = await db
    .select()
    .from(venues)
    .where(and(eq(venues.id, input.venueId), isNull(venues.archivedAt)))
    .limit(1);

  if (!existing) {
    return { ok: false, status: 404, error: "Venue not found" };
  }

  if (input.action === "reject") {
    const note = input.note?.trim() ?? "";
    if (!note) {
      return {
        ok: false,
        status: 400,
        error: "A note is required when rejecting a venue",
        reason: "note_required",
      };
    }
  }

  const now = new Date();
  const reviewStatus: VenueReviewStatus =
    input.action === "approve" ? "approved" : "rejected";
  const note =
    input.action === "reject"
      ? (input.note?.trim() ?? null)
      : input.note?.trim() || null;

  const [updated] = await db
    .update(venues)
    .set({
      reviewStatus,
      reviewNote: note,
      reviewedAt: now,
      reviewedBy: input.admin.email,
      updatedAt: now,
    })
    .where(eq(venues.id, input.venueId))
    .returning();

  const [profile] = await db
    .select({ userId: recruiterProfiles.userId })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.id, existing.recruiterProfileId))
    .limit(1);

  await recordAdminAuditEvent({
    action: input.action === "approve" ? "venue_approved" : "venue_rejected",
    actorAdminEmail: input.admin.email,
    actorUserId: input.admin.userId,
    targetUserId: profile?.userId ?? null,
    targetType: "venue",
    targetId: existing.id,
    reason: note,
    metadata: {
      venueName: existing.name,
      venueLinkUrl: existing.venueLinkUrl,
      venueLinkKind: existing.venueLinkKind,
      previousStatus: existing.reviewStatus,
      reviewStatus,
    },
    createdAt: now,
  });

  return { ok: true, venue: updated, action: input.action };
}

export interface PendingVenueForAdmin {
  id: string;
  name: string;
  area: string | null;
  subArea: string | null;
  venueLinkUrl: string;
  venueLinkKind: Venue["venueLinkKind"];
  reviewStatus: VenueReviewStatus;
  reviewNote: string | null;
  createdAt: Date;
  recruiterProfileId: string;
  recruiterEmail: string | null;
  recruiterVerificationStatus: string | null;
  organizationName: string | null;
}

export async function listPendingVenuesForAdmin(): Promise<
  PendingVenueForAdmin[]
> {
  const rows = await db
    .select({
      id: venues.id,
      name: venues.name,
      area: venues.area,
      subArea: venues.subArea,
      venueLinkUrl: venues.venueLinkUrl,
      venueLinkKind: venues.venueLinkKind,
      reviewStatus: venues.reviewStatus,
      reviewNote: venues.reviewNote,
      createdAt: venues.createdAt,
      recruiterProfileId: venues.recruiterProfileId,
      recruiterEmail: users.email,
      recruiterVerificationStatus: recruiterProfiles.verificationStatus,
      organizationName: recruiterProfiles.organizationName,
    })
    .from(venues)
    .innerJoin(
      recruiterProfiles,
      eq(venues.recruiterProfileId, recruiterProfiles.id)
    )
    .innerJoin(users, eq(recruiterProfiles.userId, users.id))
    .where(and(eq(venues.reviewStatus, "pending"), isNull(venues.archivedAt)))
    .orderBy(venues.createdAt);

  return rows;
}
