import { and, count, desc, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contactRequests,
  conversations,
  messages,
  recruiterProfiles,
  reports,
  venues,
  workerProfiles,
  type Report,
  type ReportReason,
} from "@/lib/db/schema";
import { getMessagingSettings } from "@/lib/messaging/settings";
import { notifyAdmins } from "@/lib/safety/notify-admins";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LEGAL_HOLD_DAYS = 730;
const MAX_DETAILS_LENGTH = 2000;
const REPORTS_PER_DAY_LIMIT = 10;
const EVIDENCE_MESSAGE_LIMIT = 50;

export const REPORT_REASONS: ReportReason[] = [
  "scam_or_fake_job",
  "asked_for_money",
  "asked_for_documents",
  "harassment",
  "sexual_content",
  "underage_concern",
  "trafficking_concern",
  "spam",
  "other",
];

/** Severity order for admin queues (highest first). */
export const REPORT_SEVERITY_ORDER: ReportReason[] = [
  "trafficking_concern",
  "underage_concern",
  "asked_for_documents",
  "asked_for_money",
  "scam_or_fake_job",
  "sexual_content",
  "harassment",
  "spam",
  "other",
];

export interface CreateReportInput {
  reporterUserId: string;
  reason: ReportReason;
  details?: string | null;
  contactRequestId?: string | null;
  conversationId?: string | null;
  /** Resolve worker user id from profile id (recruiter reporting a worker). */
  reportedWorkerProfileId?: string | null;
  /** Worker reporting a venue; recruiter derived server-side. */
  reportedVenueId?: string | null;
  now?: Date;
}

export type CreateReportResult =
  | { ok: true; report: Report; autoPaused: boolean }
  | { ok: false; status: number; error: string; code?: string };

interface EvidenceSnapshot {
  request: {
    opener: string;
    followUp: string | null;
    venueName: string | null;
    createdAt: string;
  } | null;
  messages: Array<{
    id: string;
    senderRole: "worker" | "recruiter" | "system" | "unknown";
    body: string;
    kind: string;
    createdAt: string;
  }>;
}

function trimDetails(details: string | null | undefined): string | null {
  if (!details) return null;
  const trimmed = details.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_DETAILS_LENGTH);
}

async function countReporterReportsToday(
  reporterUserId: string,
  now: Date
): Promise<number> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ value: count() })
    .from(reports)
    .where(
      and(
        eq(reports.reporterUserId, reporterUserId),
        gte(reports.createdAt, dayStart)
      )
    );

  return Number(row?.value ?? 0);
}

async function buildEvidenceSnapshot(input: {
  contactRequestId: string | null;
  conversationId: string | null;
  workerUserId: string | null;
  recruiterUserId: string | null;
}): Promise<EvidenceSnapshot> {
  let requestSnapshot: EvidenceSnapshot["request"] = null;

  const requestId = input.contactRequestId;
  if (requestId) {
    const [row] = await db
      .select({
        openerText: contactRequests.openerText,
        followUpText: contactRequests.followUpText,
        createdAt: contactRequests.createdAt,
        venueName: venues.name,
      })
      .from(contactRequests)
      .leftJoin(venues, eq(venues.id, contactRequests.venueId))
      .where(eq(contactRequests.id, requestId))
      .limit(1);

    if (row) {
      requestSnapshot = {
        opener: row.openerText,
        followUp: row.followUpText,
        venueName: row.venueName ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    }
  }

  const messageRows: EvidenceSnapshot["messages"] = [];
  if (input.conversationId) {
    const rows = await db
      .select({
        id: messages.id,
        senderUserId: messages.senderUserId,
        body: messages.body,
        kind: messages.kind,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, input.conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(EVIDENCE_MESSAGE_LIMIT);

    for (const row of rows.reverse()) {
      let senderRole: EvidenceSnapshot["messages"][number]["senderRole"] =
        "unknown";
      if (!row.senderUserId) {
        senderRole = "system";
      } else if (row.senderUserId === input.workerUserId) {
        senderRole = "worker";
      } else if (row.senderUserId === input.recruiterUserId) {
        senderRole = "recruiter";
      }
      messageRows.push({
        id: row.id,
        senderRole,
        body: row.body,
        kind: row.kind,
        createdAt: row.createdAt.toISOString(),
      });
    }
  }

  return { request: requestSnapshot, messages: messageRows };
}

/**
 * Only interaction-backed reports where the reporter is the worker participant
 * count toward auto-pause.
 */
export async function countDistinctReportersForRecruiter(
  reportedUserId: string,
  windowDays: number,
  now: Date
): Promise<number> {
  const since = new Date(now.getTime() - windowDays * MS_PER_DAY);
  const [row] = await db
    .select({
      value: sql<number>`count(distinct ${reports.reporterUserId})::int`,
    })
    .from(reports)
    .leftJoin(
      contactRequests,
      eq(contactRequests.id, reports.contactRequestId)
    )
    .leftJoin(conversations, eq(conversations.id, reports.conversationId))
    .where(
      and(
        eq(reports.reportedUserId, reportedUserId),
        gte(reports.createdAt, since),
        or(
          and(
            isNotNull(reports.contactRequestId),
            eq(contactRequests.workerUserId, reports.reporterUserId)
          ),
          and(
            isNotNull(reports.conversationId),
            eq(conversations.workerUserId, reports.reporterUserId)
          )
        )
      )
    );
  return Number(row?.value ?? 0);
}

async function maybeAutoPauseRecruiter(input: {
  reportedUserId: string;
  now: Date;
}): Promise<boolean> {
  const [profile] = await db
    .select({
      id: recruiterProfiles.id,
      messagingPausedAt: recruiterProfiles.messagingPausedAt,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, input.reportedUserId))
    .limit(1);

  if (!profile) {
    return false;
  }
  if (profile.messagingPausedAt) {
    return false;
  }

  const settings = await getMessagingSettings();
  const distinctReporters = await countDistinctReportersForRecruiter(
    input.reportedUserId,
    settings.autoPauseWindowDays,
    input.now
  );

  if (distinctReporters < settings.autoPauseReportThreshold) {
    return false;
  }

  await db
    .update(recruiterProfiles)
    .set({
      messagingPausedAt: input.now,
      messagingPausedReason: "system:auto_reports",
      messagingPausedBy: "system:auto_reports",
      updatedAt: input.now,
    })
    .where(eq(recruiterProfiles.id, profile.id));

  await notifyAdmins({
    subject: "Recruiter messaging auto-paused after reports",
    body: `Recruiter ${input.reportedUserId} was auto-paused after ${distinctReporters} distinct reporters within ${settings.autoPauseWindowDays} days (threshold ${settings.autoPauseReportThreshold}).`,
    metadata: {
      reportedUserId: input.reportedUserId,
      distinctReporters,
      threshold: settings.autoPauseReportThreshold,
      windowDays: settings.autoPauseWindowDays,
    },
  });

  return true;
}

async function resolveReportedVenue(input: {
  reporterUserId: string;
  venueId: string;
}): Promise<
  | { ok: true; reportedUserId: string }
  | { ok: false; status: number; error: string; code: string }
> {
  const [venue] = await db
    .select({
      id: venues.id,
      reviewStatus: venues.reviewStatus,
      recruiterUserId: recruiterProfiles.userId,
    })
    .from(venues)
    .innerJoin(
      recruiterProfiles,
      eq(recruiterProfiles.id, venues.recruiterProfileId)
    )
    .where(eq(venues.id, input.venueId))
    .limit(1);

  if (!venue) {
    return {
      ok: false,
      status: 404,
      error: "Venue not found",
      code: "not_found",
    };
  }

  if (venue.reviewStatus === "approved") {
    return { ok: true, reportedUserId: venue.recruiterUserId };
  }

  const [request] = await db
    .select({ id: contactRequests.id })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.workerUserId, input.reporterUserId),
        eq(contactRequests.recruiterUserId, venue.recruiterUserId)
      )
    )
    .limit(1);

  if (!request) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      code: "venue_not_allowed",
    };
  }

  return { ok: true, reportedUserId: venue.recruiterUserId };
}

export async function createReport(
  input: CreateReportInput
): Promise<CreateReportResult> {
  const now = input.now ?? new Date();
  const reason = input.reason;
  if (!REPORT_REASONS.includes(reason)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid report reason",
      code: "invalid_reason",
    };
  }

  const details = trimDetails(input.details);
  const todayCount = await countReporterReportsToday(input.reporterUserId, now);
  if (todayCount >= REPORTS_PER_DAY_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: "Too many reports today. Please try again tomorrow.",
      code: "rate_limited",
    };
  }

  let contactRequestId = input.contactRequestId ?? null;
  let conversationId = input.conversationId ?? null;
  let reportedUserId: string | null = null;
  let workerUserId: string | null = null;
  let recruiterUserId: string | null = null;
  let countsTowardAutoPause = false;

  if (conversationId) {
    const [convo] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!convo) {
      return {
        ok: false,
        status: 404,
        error: "Conversation not found",
        code: "not_found",
      };
    }

    if (
      convo.workerUserId !== input.reporterUserId &&
      convo.recruiterUserId !== input.reporterUserId
    ) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden",
        code: "not_participant",
      };
    }

    workerUserId = convo.workerUserId;
    recruiterUserId = convo.recruiterUserId;
    contactRequestId = contactRequestId ?? convo.contactRequestId;
    reportedUserId =
      convo.workerUserId === input.reporterUserId
        ? convo.recruiterUserId
        : convo.workerUserId;
    countsTowardAutoPause = convo.workerUserId === input.reporterUserId;
  } else if (contactRequestId) {
    const [request] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, contactRequestId))
      .limit(1);

    if (!request) {
      return {
        ok: false,
        status: 404,
        error: "Contact request not found",
        code: "not_found",
      };
    }

    if (
      request.workerUserId !== input.reporterUserId &&
      request.recruiterUserId !== input.reporterUserId
    ) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden",
        code: "not_participant",
      };
    }

    workerUserId = request.workerUserId;
    recruiterUserId = request.recruiterUserId;
    reportedUserId =
      request.workerUserId === input.reporterUserId
        ? request.recruiterUserId
        : request.workerUserId;
    countsTowardAutoPause = request.workerUserId === input.reporterUserId;

    const [linkedConvo] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.contactRequestId, contactRequestId))
      .limit(1);
    conversationId = linkedConvo?.id ?? null;
  } else if (input.reportedWorkerProfileId) {
    const [profile] = await db
      .select({ userId: workerProfiles.userId })
      .from(workerProfiles)
      .where(eq(workerProfiles.id, input.reportedWorkerProfileId))
      .limit(1);
    if (!profile) {
      return {
        ok: false,
        status: 404,
        error: "Worker profile not found",
        code: "not_found",
      };
    }
    reportedUserId = profile.userId;
    countsTowardAutoPause = false;
  } else if (input.reportedVenueId) {
    const venueResult = await resolveReportedVenue({
      reporterUserId: input.reporterUserId,
      venueId: input.reportedVenueId,
    });
    if (!venueResult.ok) {
      return venueResult;
    }
    reportedUserId = venueResult.reportedUserId;
    countsTowardAutoPause = false;
  } else {
    return {
      ok: false,
      status: 400,
      error: "A report target is required",
      code: "missing_target",
    };
  }

  if (!reportedUserId) {
    return {
      ok: false,
      status: 400,
      error: "Could not determine reported user",
      code: "missing_target",
    };
  }

  if (reportedUserId === input.reporterUserId) {
    return {
      ok: false,
      status: 400,
      error: "You cannot report yourself",
      code: "invalid_target",
    };
  }

  const evidenceSnapshot = await buildEvidenceSnapshot({
    contactRequestId,
    conversationId,
    workerUserId,
    recruiterUserId,
  });

  const legalHoldUntil = new Date(now.getTime() + LEGAL_HOLD_DAYS * MS_PER_DAY);

  const [report] = await db
    .insert(reports)
    .values({
      reporterUserId: input.reporterUserId,
      reportedUserId,
      contactRequestId,
      conversationId,
      reason,
      details,
      evidenceSnapshot: evidenceSnapshot as unknown as Record<string, unknown>,
      status: "open",
      createdAt: now,
    })
    .returning();

  if (conversationId) {
    await db
      .update(conversations)
      .set({ legalHoldUntil })
      .where(eq(conversations.id, conversationId));
  } else if (contactRequestId) {
    const [linked] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.contactRequestId, contactRequestId))
      .limit(1);
    if (linked) {
      await db
        .update(conversations)
        .set({ legalHoldUntil })
        .where(eq(conversations.id, linked.id));
    }
  }

  if (contactRequestId && workerUserId === input.reporterUserId) {
    await db
      .update(contactRequests)
      .set({
        status: "declined",
        respondedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(contactRequests.id, contactRequestId),
          eq(contactRequests.status, "pending"),
          eq(contactRequests.workerUserId, input.reporterUserId)
        )
      );
  }

  const autoPaused = countsTowardAutoPause
    ? await maybeAutoPauseRecruiter({ reportedUserId, now })
    : false;

  return { ok: true, report, autoPaused };
}

export async function countOpenReports(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(reports)
    .where(inArray(reports.status, ["open", "reviewing"]));
  return Number(row?.value ?? 0);
}
