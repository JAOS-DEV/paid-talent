import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import {
  contactRequests,
  conversations,
  db,
  recruiterOpenings,
  users,
  venues,
  workerProfiles,
} from "@/lib/db";
import {
  formatOpeningPay,
  joinOpeningContextAndPay,
} from "@/lib/recruiter-profile/opening-pay";
import { resolveOpeningContext } from "@/lib/hire-outcomes/confirmations";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import { getLimitsForRecruiter, releaseQueuedForWorker } from "./service";

export interface InboxContactRequestDto {
  id: string;
  status: string;
  openerText: string;
  followUpText: string | null;
  followUpSentAt: string | null;
  deliveredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  recruiterFirstName: string | null;
  venue: {
    id: string | null;
    name: string | null;
    logoUrl: string | null;
    linkUrl: string | null;
    linkApproved: boolean;
  };
  openingSummary: string | null;
  conversationId: string | null;
}

export interface SentContactRequestDto {
  id: string;
  status: string;
  isPro: boolean;
  isTopTalentTarget: boolean;
  openerText: string;
  followUpText: string | null;
  followUpSentAt: string | null;
  deliveredAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  workerProfileId: string;
  workerDisplayName: string;
  workerPhotoUrl: string | null;
  venueName: string | null;
  openingSummary: string | null;
  conversationId: string | null;
  followUpEligible: boolean;
}

function firstName(name: string | null): string | null {
  if (!name) return null;
  const part = name.trim().split(/\s+/)[0];
  return part || null;
}

export async function listWorkerInbox(
  workerUserId: string,
  workerProfileId: string,
  now: Date = new Date()
): Promise<InboxContactRequestDto[]> {
  await releaseQueuedForWorker(workerProfileId, now);

  const rows = await db
    .select({
      id: contactRequests.id,
      status: contactRequests.status,
      openerText: contactRequests.openerText,
      followUpText: contactRequests.followUpText,
      followUpSentAt: contactRequests.followUpSentAt,
      deliveredAt: contactRequests.deliveredAt,
      expiresAt: contactRequests.expiresAt,
      createdAt: contactRequests.createdAt,
      recruiterName: users.name,
      venueId: venues.id,
      venueName: venues.name,
      venueLogoUrl: venues.logoUrl,
      venueLinkUrl: venues.venueLinkUrl,
      venueReviewStatus: venues.reviewStatus,
      openingRole: recruiterOpenings.role,
      openingArea: recruiterOpenings.area,
      payMin: recruiterOpenings.payMin,
      payMax: recruiterOpenings.payMax,
      payCurrency: recruiterOpenings.payCurrency,
      payPeriod: recruiterOpenings.payPeriod,
      openingIsPublished: recruiterOpenings.isPublished,
      conversationId: conversations.id,
    })
    .from(contactRequests)
    .innerJoin(users, eq(users.id, contactRequests.recruiterUserId))
    .leftJoin(venues, eq(venues.id, contactRequests.venueId))
    .leftJoin(
      recruiterOpenings,
      eq(recruiterOpenings.id, contactRequests.openingId)
    )
    .leftJoin(
      conversations,
      eq(conversations.contactRequestId, contactRequests.id)
    )
    .where(
      and(
        eq(contactRequests.workerProfileId, workerProfileId),
        isNotNull(contactRequests.deliveredAt),
        isNull(contactRequests.workerHiddenAt),
        inArray(contactRequests.status, [
          "pending",
          "accepted",
          "declined",
          "expired",
          "withdrawn",
        ])
      )
    )
    .orderBy(desc(contactRequests.isPro), desc(contactRequests.deliveredAt));

  return rows.map((row) => {
    const openingSummary =
      row.openingIsPublished === true
        ? joinOpeningContextAndPay(
            resolveOpeningContext(row.openingRole, row.openingArea),
            formatOpeningPay({
              payMin: row.payMin,
              payMax: row.payMax,
              payCurrency: row.payCurrency,
              payPeriod: row.payPeriod,
            })
          )
        : null;

    return {
      id: row.id,
      status: row.status,
      openerText: row.openerText,
      followUpText: row.followUpText,
      followUpSentAt: row.followUpSentAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      recruiterFirstName: firstName(row.recruiterName),
      venue: {
        id: row.venueId,
        name: row.venueName,
        logoUrl: toPublicVenueLogoUrl(row.venueLogoUrl),
        linkUrl:
          row.venueReviewStatus === "approved" ? row.venueLinkUrl : null,
        linkApproved: row.venueReviewStatus === "approved",
      },
      openingSummary,
      conversationId: row.conversationId,
    };
  });
}

export async function listRecruiterSent(
  recruiterUserId: string,
  followUpAfterHours: number,
  now: Date = new Date()
): Promise<{
  requests: SentContactRequestDto[];
  limits: Awaited<ReturnType<typeof getLimitsForRecruiter>>;
}> {
  const rows = await db
    .select({
      id: contactRequests.id,
      status: contactRequests.status,
      isPro: contactRequests.isPro,
      isTopTalentTarget: contactRequests.isTopTalentTarget,
      openerText: contactRequests.openerText,
      followUpText: contactRequests.followUpText,
      followUpSentAt: contactRequests.followUpSentAt,
      deliveredAt: contactRequests.deliveredAt,
      expiresAt: contactRequests.expiresAt,
      respondedAt: contactRequests.respondedAt,
      createdAt: contactRequests.createdAt,
      workerProfileId: contactRequests.workerProfileId,
      workerDisplayName: workerProfiles.displayName,
      workerPhotoUrl: workerProfiles.photoUrl,
      venueName: venues.name,
      openingRole: recruiterOpenings.role,
      openingArea: recruiterOpenings.area,
      payMin: recruiterOpenings.payMin,
      payMax: recruiterOpenings.payMax,
      payCurrency: recruiterOpenings.payCurrency,
      payPeriod: recruiterOpenings.payPeriod,
      conversationId: conversations.id,
    })
    .from(contactRequests)
    .innerJoin(
      workerProfiles,
      eq(workerProfiles.id, contactRequests.workerProfileId)
    )
    .leftJoin(venues, eq(venues.id, contactRequests.venueId))
    .leftJoin(
      recruiterOpenings,
      eq(recruiterOpenings.id, contactRequests.openingId)
    )
    .leftJoin(
      conversations,
      eq(conversations.contactRequestId, contactRequests.id)
    )
    .where(eq(contactRequests.recruiterUserId, recruiterUserId))
    .orderBy(desc(contactRequests.createdAt));

  const followUpMs = followUpAfterHours * 60 * 60 * 1000;

  const requests: SentContactRequestDto[] = rows.map((row) => {
    const openingSummary = joinOpeningContextAndPay(
      resolveOpeningContext(row.openingRole, row.openingArea),
      formatOpeningPay({
        payMin: row.payMin,
        payMax: row.payMax,
        payCurrency: row.payCurrency,
        payPeriod: row.payPeriod,
      })
    );

    const followUpEligible =
      row.status === "pending" &&
      row.followUpSentAt == null &&
      row.deliveredAt != null &&
      now.getTime() - row.deliveredAt.getTime() >= followUpMs;

    return {
      id: row.id,
      status: row.status,
      isPro: row.isPro,
      isTopTalentTarget: row.isTopTalentTarget,
      openerText: row.openerText,
      followUpText: row.followUpText,
      followUpSentAt: row.followUpSentAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      workerProfileId: row.workerProfileId,
      workerDisplayName: row.workerDisplayName,
      workerPhotoUrl: row.workerPhotoUrl,
      venueName: row.venueName,
      openingSummary: openingSummary || null,
      conversationId: row.conversationId,
      followUpEligible,
    };
  });

  const limits = await getLimitsForRecruiter(recruiterUserId, now);

  return { requests, limits };
}

export async function countWorkerPendingRequests(
  workerProfileId: string
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.workerProfileId, workerProfileId),
        eq(contactRequests.status, "pending"),
        isNotNull(contactRequests.deliveredAt),
        isNull(contactRequests.workerHiddenAt)
      )
    );

  return Number(row?.value ?? 0);
}

export async function getContactRequestForWorkerApi(
  recruiterUserId: string,
  workerProfileId: string
): Promise<{ id: string; status: string } | null> {
  const [row] = await db
    .select({
      id: contactRequests.id,
      status: contactRequests.status,
    })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.recruiterUserId, recruiterUserId),
        eq(contactRequests.workerProfileId, workerProfileId),
        ne(contactRequests.status, "withdrawn")
      )
    )
    .orderBy(desc(contactRequests.createdAt))
    .limit(1);

  return row ?? null;
}
