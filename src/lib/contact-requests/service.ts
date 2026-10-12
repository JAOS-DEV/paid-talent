import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import {
  contactRequests,
  conversations,
  db,
  profileInterests,
  recruiterOpenings,
  userNotificationPrefs,
  users,
  workerProfiles,
  type ContactRequest,
  type Conversation,
} from "@/lib/db";
import { containsBlockedContact } from "@/lib/helpers/text-filter";
import { resolveOpeningAttachment } from "@/lib/interests/opening-attachment";
import {
  bangkokDayRange,
  effectiveLimitsFor,
  evaluateNewRequest,
  resolveWorkerInboundLimit,
  workerInboundDecision,
  type EffectiveLimits,
} from "@/lib/messaging/caps";
import { getMessagingSettings } from "@/lib/messaging/settings";
import { isProfileTopTalent } from "@/lib/ranking";
import { getRecruiterAccess } from "@/lib/recruiter-access";
import { isSearchableWorker } from "@/lib/verification";
import {
  capDenyError,
  serviceError,
  type ContactRequestServiceError,
} from "./errors";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ["queued", "pending", "accepted"] as const;

export interface LimitsWithRemaining extends EffectiveLimits {
  remainingDaily: number;
  remainingWeekly: number;
  remainingPending: number;
  remainingTopTalent: number | null;
  usedDaily: number;
  usedWeekly: number;
  usedPending: number;
  usedTopTalent: number;
}

export interface CreateContactRequestInput {
  recruiterUserId: string;
  workerProfileId: string;
  venueId: string;
  openerText: string;
  openingId?: string | null;
  now?: Date;
}

export type CreateContactRequestResult =
  | { ok: true; request: ContactRequest; limits: LimitsWithRemaining }
  | ContactRequestServiceError;

function trimOpener(text: string): string {
  return text.trim();
}

function withRemaining(
  limits: EffectiveLimits,
  counts: {
    last24h: number;
    last7d: number;
    pending: number;
    topTalentLast24h: number;
  }
): LimitsWithRemaining {
  return {
    ...limits,
    usedDaily: counts.last24h,
    usedWeekly: counts.last7d,
    usedPending: counts.pending,
    usedTopTalent: counts.topTalentLast24h,
    remainingDaily: Math.max(0, limits.dailyNew - counts.last24h),
    remainingWeekly: Math.max(0, limits.weeklyNew - counts.last7d),
    remainingPending: Math.max(0, limits.pendingMax - counts.pending),
    remainingTopTalent:
      limits.topTalentDaily == null
        ? null
        : Math.max(0, limits.topTalentDaily - counts.topTalentLast24h),
  };
}

async function advisoryLocks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  recruiterUserId: string,
  workerProfileId: string
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${recruiterUserId}::text, 0))`
  );
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${workerProfileId}::text, 1))`
  );
}

async function workerAdvisoryLock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workerProfileId: string
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${workerProfileId}::text, 1))`
  );
}

/** TODO: wire block checks when the blocks PR lands. */
function isBlockedEitherWay(): boolean {
  return false;
}

export async function getRecruiterCapCounts(
  recruiterUserId: string,
  now: Date,
  client: Pick<typeof db, "select"> = db
): Promise<{
  last24h: number;
  last7d: number;
  pending: number;
  topTalentLast24h: number;
}> {
  const dayStart = bangkokDayRange(now).start;
  const weekStart = new Date(now.getTime() - 7 * MS_PER_DAY);

  const [dailyRow] = await client
    .select({ value: count() })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.recruiterUserId, recruiterUserId),
        eq(contactRequests.countsTowardCaps, true),
        gte(contactRequests.createdAt, dayStart)
      )
    );

  const [weeklyRow] = await client
    .select({ value: count() })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.recruiterUserId, recruiterUserId),
        eq(contactRequests.countsTowardCaps, true),
        gte(contactRequests.createdAt, weekStart)
      )
    );

  const [pendingRow] = await client
    .select({ value: count() })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.recruiterUserId, recruiterUserId),
        eq(contactRequests.countsTowardCaps, true),
        inArray(contactRequests.status, ["queued", "pending"])
      )
    );

  const [topTalentRow] = await client
    .select({ value: count() })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.recruiterUserId, recruiterUserId),
        eq(contactRequests.countsTowardCaps, true),
        eq(contactRequests.isTopTalentTarget, true),
        gte(contactRequests.createdAt, dayStart)
      )
    );

  return {
    last24h: Number(dailyRow?.value ?? 0),
    last7d: Number(weeklyRow?.value ?? 0),
    pending: Number(pendingRow?.value ?? 0),
    topTalentLast24h: Number(topTalentRow?.value ?? 0),
  };
}

export async function getLimitsForRecruiter(
  recruiterUserId: string,
  now: Date = new Date()
): Promise<LimitsWithRemaining | null> {
  const access = await getRecruiterAccess(recruiterUserId);
  if (!access.recruiterProfileId) return null;
  const settings = await getMessagingSettings();
  const counts = await getRecruiterCapCounts(recruiterUserId, now);
  const limits = effectiveLimitsFor(
    access.tier,
    settings,
    access.verifiedAt,
    now
  );
  return withRemaining(limits, counts);
}

export async function createContactRequest(
  input: CreateContactRequestInput
): Promise<CreateContactRequestResult> {
  const now = input.now ?? new Date();
  const openerText = trimOpener(input.openerText);

  if (!openerText) {
    return serviceError("opener_required", 422, "Opener text is required");
  }

  if (containsBlockedContact(openerText)) {
    return serviceError(
      "contact_info_blocked",
      422,
      "Contact information is not allowed in the opener"
    );
  }

  const access = await getRecruiterAccess(input.recruiterUserId);
  if (!access.recruiterProfileId) {
    return serviceError("not_verified", 403, "Recruiter not verified");
  }

  if (!access.approvedVenueIds.includes(input.venueId)) {
    return serviceError(
      "venue_not_allowed",
      403,
      "Venue is not an approved venue for this recruiter"
    );
  }

  if (access.tier === "free" && input.venueId !== access.primaryVenueId) {
    return serviceError(
      "venue_not_primary",
      403,
      "Free recruiters can only send requests from their primary venue"
    );
  }

  const [workerRow] = await db
    .select({
      profile: workerProfiles,
      accountStatus: users.accountStatus,
    })
    .from(workerProfiles)
    .innerJoin(users, eq(users.id, workerProfiles.userId))
    .where(eq(workerProfiles.id, input.workerProfileId))
    .limit(1);

  if (!workerRow) {
    return serviceError("worker_not_found", 404, "Worker profile not found");
  }

  if (workerRow.accountStatus !== "active") {
    return serviceError("worker_inactive", 403, "Worker account is not active");
  }

  const searchable = isSearchableWorker(workerRow.profile);
  if (!searchable.isSearchable) {
    return serviceError(
      "worker_not_searchable",
      422,
      "Worker is not available for contact requests"
    );
  }

  let resolvedOpeningId: string | null = null;
  if (input.openingId) {
    const [opening] = await db
      .select({
        id: recruiterOpenings.id,
        recruiterProfileId: recruiterOpenings.recruiterProfileId,
        isPublished: recruiterOpenings.isPublished,
        venueId: recruiterOpenings.venueId,
      })
      .from(recruiterOpenings)
      .where(eq(recruiterOpenings.id, input.openingId))
      .limit(1);

    const attachment = resolveOpeningAttachment({
      openingId: input.openingId,
      recruiterProfileId: access.recruiterProfileId,
      opening: opening
        ? {
            id: opening.id,
            recruiterProfileId: opening.recruiterProfileId,
            isPublished: opening.isPublished,
          }
        : null,
    });

    if (!attachment.ok) {
      return serviceError(
        "opening_venue_mismatch",
        attachment.status === 404 ? 404 : 403,
        attachment.error
      );
    }

    if (opening && opening.venueId !== input.venueId) {
      return serviceError(
        "opening_venue_mismatch",
        422,
        "Opening must belong to the selected venue"
      );
    }

    resolvedOpeningId = attachment.openingId;
  }

  const settings = await getMessagingSettings();
  const isTopTalent = await isProfileTopTalent(input.workerProfileId);
  const openAccess = access.billingAccessMode === "open_access";

  try {
    return await db.transaction(async (tx) => {
      await advisoryLocks(tx, input.recruiterUserId, input.workerProfileId);

      const counts = await getRecruiterCapCounts(
        input.recruiterUserId,
        now,
        tx
      );

      const [openRequest] = await tx
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(
          and(
            eq(contactRequests.recruiterUserId, input.recruiterUserId),
            eq(contactRequests.workerProfileId, input.workerProfileId),
            inArray(contactRequests.status, [...OPEN_STATUSES])
          )
        )
        .limit(1);

      const [lastDeclined] = await tx
        .select({ respondedAt: contactRequests.respondedAt })
        .from(contactRequests)
        .where(
          and(
            eq(contactRequests.recruiterUserId, input.recruiterUserId),
            eq(contactRequests.workerProfileId, input.workerProfileId),
            eq(contactRequests.status, "declined")
          )
        )
        .orderBy(desc(contactRequests.respondedAt))
        .limit(1);

      const evaluation = evaluateNewRequest({
        tier: access.tier,
        isPaused: access.isPaused,
        openAccess,
        verifiedAt: access.verifiedAt,
        now,
        settings,
        counts,
        target: { isTopTalent },
        hasOpenRequestToTarget: Boolean(openRequest),
        lastDeclinedByTargetAt: lastDeclined?.respondedAt ?? null,
        isBlockedEitherWay: isBlockedEitherWay(),
        openerLength: openerText.length,
        hasOpeningAttached: resolvedOpeningId != null,
      });

      if (!evaluation.ok) {
        return capDenyError(evaluation.reason, evaluation.retryAfter);
      }

      const [prefs] = await tx
        .select()
        .from(userNotificationPrefs)
        .where(eq(userNotificationPrefs.userId, workerRow.profile.userId))
        .limit(1);

      const dayRange = bangkokDayRange(now);
      const [deliveredRow] = await tx
        .select({ value: count() })
        .from(contactRequests)
        .where(
          and(
            eq(contactRequests.workerProfileId, input.workerProfileId),
            gte(contactRequests.deliveredAt, dayRange.start),
            lt(contactRequests.deliveredAt, dayRange.end)
          )
        );

      const inboundLimit = resolveWorkerInboundLimit(
        prefs?.inboundDailyLimit ?? null,
        settings
      );
      const inboundDecision = workerInboundDecision({
        deliveredToday: Number(deliveredRow?.value ?? 0),
        limit: inboundLimit,
        paused: prefs?.inboundPaused === true,
      });

      const expiresAt =
        inboundDecision === "deliver"
          ? new Date(now.getTime() + settings.requestExpiryDays * MS_PER_DAY)
          : null;

      const [request] = await tx
        .insert(contactRequests)
        .values({
          recruiterUserId: input.recruiterUserId,
          recruiterProfileId: access.recruiterProfileId!,
          venueId: input.venueId,
          workerProfileId: input.workerProfileId,
          workerUserId: workerRow.profile.userId,
          openingId: resolvedOpeningId,
          openerText,
          status: inboundDecision === "deliver" ? "pending" : "queued",
          isPro: access.tier === "pro",
          isTopTalentTarget: isTopTalent,
          countsTowardCaps: true,
          deliveredAt: inboundDecision === "deliver" ? now : null,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const nextCounts = {
        last24h: counts.last24h + 1,
        last7d: counts.last7d + 1,
        pending: counts.pending + 1,
        topTalentLast24h:
          counts.topTalentLast24h + (isTopTalent ? 1 : 0),
      };

      return {
        ok: true as const,
        request,
        limits: withRemaining(evaluation.limits, nextCounts),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return capDenyError("duplicate");
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    maybeCode === "23505" ||
    message.includes("contact_requests_open_pair_uidx") ||
    message.toLowerCase().includes("unique")
  );
}

export async function releaseQueuedForWorker(
  workerProfileId: string,
  now: Date = new Date()
): Promise<number> {
  const settings = await getMessagingSettings();

  return db.transaction(async (tx) => {
    await workerAdvisoryLock(tx, workerProfileId);

    const [worker] = await tx
      .select({ userId: workerProfiles.userId })
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerProfileId))
      .limit(1);

    if (!worker) return 0;

    const [prefs] = await tx
      .select()
      .from(userNotificationPrefs)
      .where(eq(userNotificationPrefs.userId, worker.userId))
      .limit(1);

    if (prefs?.inboundPaused) return 0;

    const limit = resolveWorkerInboundLimit(
      prefs?.inboundDailyLimit ?? null,
      settings
    );
    const dayRange = bangkokDayRange(now);

    const [deliveredRow] = await tx
      .select({ value: count() })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.workerProfileId, workerProfileId),
          gte(contactRequests.deliveredAt, dayRange.start),
          lt(contactRequests.deliveredAt, dayRange.end)
        )
      );

    const slots = Math.max(0, limit - Number(deliveredRow?.value ?? 0));
    if (slots <= 0) return 0;

    const queued = await tx
      .select()
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.workerProfileId, workerProfileId),
          eq(contactRequests.status, "queued")
        )
      )
      .orderBy(desc(contactRequests.isPro), asc(contactRequests.createdAt))
      .limit(slots);

    let released = 0;
    for (const row of queued) {
      await tx
        .update(contactRequests)
        .set({
          status: "pending",
          deliveredAt: now,
          expiresAt: new Date(
            now.getTime() + settings.requestExpiryDays * MS_PER_DAY
          ),
          updatedAt: now,
        })
        .where(eq(contactRequests.id, row.id));
      released += 1;
    }

    return released;
  });
}

export async function acceptRequest(
  workerUserId: string,
  requestId: string,
  now: Date = new Date()
): Promise<
  | { ok: true; request: ContactRequest; conversation: Conversation }
  | ContactRequestServiceError
> {
  const settings = await getMessagingSettings();

  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, requestId))
      .limit(1);

    if (!request || request.workerUserId !== workerUserId) {
      return serviceError("request_not_found", 404, "Contact request not found");
    }

    if (request.status !== "pending") {
      return serviceError(
        "invalid_status",
        409,
        "Only pending requests can be accepted"
      );
    }

    await workerAdvisoryLock(tx, request.workerProfileId);

    const [updated] = await tx
      .update(contactRequests)
      .set({
        status: "accepted",
        respondedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(contactRequests.id, requestId),
          eq(contactRequests.status, "pending")
        )
      )
      .returning();

    if (!updated) {
      return serviceError(
        "invalid_status",
        409,
        "Only pending requests can be accepted"
      );
    }

    const [conversation] = await tx
      .insert(conversations)
      .values({
        contactRequestId: updated.id,
        recruiterUserId: updated.recruiterUserId,
        workerUserId: updated.workerUserId,
        workerProfileId: updated.workerProfileId,
        venueId: updated.venueId,
        status: "open",
        lastActivityAt: now,
        retentionExpiresAt: new Date(
          now.getTime() + settings.retentionDays * MS_PER_DAY
        ),
        createdAt: now,
      })
      .returning();

    // Keep hire-outcomes FK working until profile_interests is dropped.
    await tx
      .insert(profileInterests)
      .values({
        id: updated.id,
        recruiterUserId: updated.recruiterUserId,
        workerProfileId: updated.workerProfileId,
        openingId: updated.openingId,
        message: updated.openerText,
        createdAt: updated.createdAt,
      })
      .onConflictDoNothing({ target: profileInterests.id });

    return { ok: true as const, request: updated, conversation };
  });
}

export async function declineRequest(
  workerUserId: string,
  requestId: string,
  now: Date = new Date()
): Promise<{ ok: true; request: ContactRequest } | ContactRequestServiceError> {
  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId))
    .limit(1);

  if (!request || request.workerUserId !== workerUserId) {
    return serviceError("request_not_found", 404, "Contact request not found");
  }

  if (request.status !== "pending") {
    return serviceError(
      "invalid_status",
      409,
      "Only pending requests can be declined"
    );
  }

  const [updated] = await db
    .update(contactRequests)
    .set({
      status: "declined",
      respondedAt: now,
      updatedAt: now,
      // No slot refund: countsTowardCaps stays true
    })
    .where(
      and(
        eq(contactRequests.id, requestId),
        eq(contactRequests.status, "pending")
      )
    )
    .returning();

  if (!updated) {
    return serviceError(
      "invalid_status",
      409,
      "Only pending requests can be declined"
    );
  }

  return { ok: true, request: updated };
}

export async function withdrawRequest(
  recruiterUserId: string,
  requestId: string,
  now: Date = new Date()
): Promise<{ ok: true; request: ContactRequest } | ContactRequestServiceError> {
  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId))
    .limit(1);

  if (!request || request.recruiterUserId !== recruiterUserId) {
    return serviceError("request_not_found", 404, "Contact request not found");
  }

  if (request.status !== "pending" && request.status !== "queued") {
    return serviceError(
      "invalid_status",
      409,
      "Only pending or queued requests can be withdrawn"
    );
  }

  const [updated] = await db
    .update(contactRequests)
    .set({
      status: "withdrawn",
      updatedAt: now,
      // No slot refund
    })
    .where(
      and(
        eq(contactRequests.id, requestId),
        inArray(contactRequests.status, ["pending", "queued"])
      )
    )
    .returning();

  if (!updated) {
    return serviceError(
      "invalid_status",
      409,
      "Only pending or queued requests can be withdrawn"
    );
  }

  return { ok: true, request: updated };
}

export async function hideRequest(
  workerUserId: string,
  requestId: string,
  now: Date = new Date()
): Promise<{ ok: true; request: ContactRequest } | ContactRequestServiceError> {
  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId))
    .limit(1);

  if (!request || request.workerUserId !== workerUserId) {
    return serviceError("request_not_found", 404, "Contact request not found");
  }

  const [updated] = await db
    .update(contactRequests)
    .set({
      workerHiddenAt: now,
      updatedAt: now,
    })
    .where(eq(contactRequests.id, requestId))
    .returning();

  return { ok: true, request: updated };
}

export async function followUp(
  recruiterUserId: string,
  requestId: string,
  text: string,
  now: Date = new Date()
): Promise<{ ok: true; request: ContactRequest } | ContactRequestServiceError> {
  const followUpText = trimOpener(text);
  if (!followUpText) {
    return serviceError("opener_required", 422, "Follow-up text is required");
  }

  if (containsBlockedContact(followUpText)) {
    return serviceError(
      "contact_info_blocked",
      422,
      "Contact information is not allowed in the follow-up"
    );
  }

  const settings = await getMessagingSettings();
  const access = await getRecruiterAccess(recruiterUserId);
  const limits = effectiveLimitsFor(
    access.tier,
    settings,
    access.verifiedAt,
    now
  );

  if (followUpText.length > limits.openerMaxChars) {
    return serviceError(
      "follow_up_too_long",
      422,
      "Follow-up text is too long"
    );
  }

  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId))
    .limit(1);

  if (!request || request.recruiterUserId !== recruiterUserId) {
    return serviceError("request_not_found", 404, "Contact request not found");
  }

  if (request.status !== "pending") {
    return serviceError(
      "invalid_status",
      409,
      "Follow-up is only allowed on pending requests"
    );
  }

  if (request.followUpSentAt) {
    return serviceError(
      "follow_up_already_sent",
      409,
      "A follow-up was already sent"
    );
  }

  if (!request.deliveredAt) {
    return serviceError(
      "follow_up_too_soon",
      422,
      "Follow-up is not available until the request is delivered"
    );
  }

  const eligibleAt = new Date(
    request.deliveredAt.getTime() + settings.followUpAfterHours * MS_PER_HOUR
  );
  if (now.getTime() < eligibleAt.getTime()) {
    return serviceError(
      "follow_up_too_soon",
      422,
      "Follow-up is not available yet",
      eligibleAt
    );
  }

  const [updated] = await db
    .update(contactRequests)
    .set({
      followUpText,
      followUpSentAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(contactRequests.id, requestId),
        eq(contactRequests.status, "pending"),
        isNull(contactRequests.followUpSentAt)
      )
    )
    .returning();

  if (!updated) {
    return serviceError(
      "follow_up_already_sent",
      409,
      "A follow-up was already sent"
    );
  }

  return { ok: true, request: updated };
}

export async function expireStale(now: Date = new Date()): Promise<number> {
  const result = await db
    .update(contactRequests)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(contactRequests.status, "pending"),
        lte(contactRequests.expiresAt, now)
      )
    )
    .returning({ id: contactRequests.id });

  return result.length;
}

export async function getWorkerInboundPrefs(userId: string): Promise<{
  dailyLimit: number;
  paused: boolean;
  defaultLimit: number;
}> {
  const settings = await getMessagingSettings();
  const [prefs] = await db
    .select()
    .from(userNotificationPrefs)
    .where(eq(userNotificationPrefs.userId, userId))
    .limit(1);

  return {
    dailyLimit: resolveWorkerInboundLimit(
      prefs?.inboundDailyLimit ?? null,
      settings
    ),
    paused: prefs?.inboundPaused === true,
    defaultLimit: settings.workerInboundDailyDefault,
  };
}

export async function updateWorkerInboundPrefs(input: {
  userId: string;
  dailyLimit?: number;
  paused?: boolean;
  now?: Date;
}): Promise<{
  dailyLimit: number;
  paused: boolean;
  defaultLimit: number;
}> {
  const now = input.now ?? new Date();
  const settings = await getMessagingSettings();
  const defaultLimit = settings.workerInboundDailyDefault;

  let dailyLimit = input.dailyLimit;
  if (dailyLimit != null) {
    dailyLimit = Math.min(defaultLimit, Math.max(1, Math.floor(dailyLimit)));
  }

  const [existing] = await db
    .select()
    .from(userNotificationPrefs)
    .where(eq(userNotificationPrefs.userId, input.userId))
    .limit(1);

  if (!existing) {
    await db.insert(userNotificationPrefs).values({
      userId: input.userId,
      inboundDailyLimit: dailyLimit ?? null,
      inboundPaused: input.paused ?? false,
      updatedAt: now,
    });
  } else {
    await db
      .update(userNotificationPrefs)
      .set({
        ...(dailyLimit !== undefined
          ? { inboundDailyLimit: dailyLimit }
          : {}),
        ...(input.paused !== undefined ? { inboundPaused: input.paused } : {}),
        updatedAt: now,
      })
      .where(eq(userNotificationPrefs.userId, input.userId));
  }

  return getWorkerInboundPrefs(input.userId);
}

export async function listWorkerIdsWithQueued(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ workerProfileId: contactRequests.workerProfileId })
    .from(contactRequests)
    .where(eq(contactRequests.status, "queued"));

  return rows.map((row) => row.workerProfileId);
}

export async function runMessagingMaintenance(
  now: Date = new Date()
): Promise<{ expired: number; released: number; workersProcessed: number }> {
  const expired = await expireStale(now);
  const workerIds = await listWorkerIdsWithQueued();
  let released = 0;
  for (const workerProfileId of workerIds) {
    released += await releaseQueuedForWorker(workerProfileId, now);
  }
  return { expired, released, workersProcessed: workerIds.length };
}
