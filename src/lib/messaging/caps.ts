import type { MessagingSettings } from "./settings";

export type CapDenyReason =
  | "not_verified"
  | "paused"
  | "daily_limit"
  | "weekly_limit"
  | "pending_limit"
  | "top_talent_requires_pro"
  | "top_talent_daily_limit"
  | "new_recruiter_daily_limit"
  | "duplicate"
  | "decline_cooldown"
  | "blocked"
  | "opener_too_long"
  | "opening_attach_requires_pro";

export type RecruiterMessagingTier = "unverified" | "free" | "pro";

export interface EffectiveLimits {
  dailyNew: number;
  weeklyNew: number;
  pendingMax: number;
  openerMaxChars: number;
  maxVenues: number;
  canAttachOpening: boolean;
  topTalentDaily: number | null;
  isNewRecruiterHold: boolean;
  baseDailyNew: number;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function isWithinNewRecruiterWindow(
  verifiedAt: Date | null,
  now: Date,
  windowDays: number
): boolean {
  if (!verifiedAt) return false;
  return now.getTime() - verifiedAt.getTime() < windowDays * MS_PER_DAY;
}

/**
 * Bangkok calendar day bounds (Asia/Bangkok, UTC+7, no DST).
 * `start` is inclusive midnight; `end` is exclusive next midnight.
 */
export function bangkokDayRange(now: Date): { start: Date; end: Date } {
  const bangkokMs = now.getTime() + BANGKOK_OFFSET_MS;
  const bangkokDayStartUtcMs =
    Math.floor(bangkokMs / MS_PER_DAY) * MS_PER_DAY - BANGKOK_OFFSET_MS;
  return {
    start: new Date(bangkokDayStartUtcMs),
    end: new Date(bangkokDayStartUtcMs + MS_PER_DAY),
  };
}

export function effectiveLimitsFor(
  tier: RecruiterMessagingTier,
  settings: MessagingSettings,
  verifiedAt: Date | null,
  now: Date
): EffectiveLimits {
  const isPro = tier === "pro";
  const baseDailyNew = isPro ? settings.paidDailyNew : settings.freeDailyNew;
  const inNewRecruiterWindow = isWithinNewRecruiterWindow(
    verifiedAt,
    now,
    settings.newRecruiterWindowDays
  );
  const dailyNew = inNewRecruiterWindow
    ? Math.min(baseDailyNew, settings.newRecruiterDailyCap)
    : baseDailyNew;

  return {
    dailyNew,
    weeklyNew: isPro ? settings.paidWeeklyNew : settings.freeWeeklyNew,
    pendingMax: isPro ? settings.paidPendingMax : settings.freePendingMax,
    openerMaxChars: isPro
      ? settings.paidOpenerMaxChars
      : settings.freeOpenerMaxChars,
    maxVenues: isPro ? settings.paidMaxVenues : settings.freeMaxVenues,
    canAttachOpening: isPro || settings.freeCanAttachOpening,
    topTalentDaily: isPro ? settings.paidDailyTopTalent : null,
    isNewRecruiterHold:
      inNewRecruiterWindow && settings.newRecruiterDailyCap < baseDailyNew,
    baseDailyNew,
  };
}

export function evaluateNewRequest(input: {
  tier: RecruiterMessagingTier;
  isPaused: boolean;
  openAccess: boolean;
  verifiedAt: Date | null;
  now: Date;
  settings: MessagingSettings;
  counts: {
    last24h: number;
    last7d: number;
    pending: number;
    topTalentLast24h: number;
  };
  target: { isTopTalent: boolean };
  hasOpenRequestToTarget: boolean;
  lastDeclinedByTargetAt: Date | null;
  isBlockedEitherWay: boolean;
  openerLength: number;
  hasOpeningAttached: boolean;
}):
  | { ok: true; limits: EffectiveLimits }
  | { ok: false; reason: CapDenyReason; retryAfter?: Date } {
  const {
    tier,
    isPaused,
    openAccess,
    verifiedAt,
    now,
    settings,
    counts,
    target,
    hasOpenRequestToTarget,
    lastDeclinedByTargetAt,
    isBlockedEitherWay,
    openerLength,
    hasOpeningAttached,
  } = input;

  if (tier === "unverified") {
    return { ok: false, reason: "not_verified" };
  }

  if (isPaused) {
    return { ok: false, reason: "paused" };
  }

  if (isBlockedEitherWay) {
    return { ok: false, reason: "blocked" };
  }

  if (hasOpenRequestToTarget) {
    return { ok: false, reason: "duplicate" };
  }

  if (lastDeclinedByTargetAt) {
    const cooldownEnds = addDays(
      lastDeclinedByTargetAt,
      settings.declineCooldownDays
    );
    if (now.getTime() < cooldownEnds.getTime()) {
      return {
        ok: false,
        reason: "decline_cooldown",
        retryAfter: cooldownEnds,
      };
    }
  }

  // Open access never upgrades caps — free stay on free limits.
  // It only unlocks Top Talent contact for free recruiters.
  if (tier === "free" && target.isTopTalent && !openAccess) {
    return { ok: false, reason: "top_talent_requires_pro" };
  }

  const limits = effectiveLimitsFor(tier, settings, verifiedAt, now);

  if (counts.last24h >= limits.dailyNew) {
    const dayEnd = bangkokDayRange(now).end;
    if (limits.isNewRecruiterHold && limits.dailyNew === settings.newRecruiterDailyCap) {
      return {
        ok: false,
        reason: "new_recruiter_daily_limit",
        retryAfter: dayEnd,
      };
    }
    return { ok: false, reason: "daily_limit", retryAfter: dayEnd };
  }

  if (counts.last7d >= limits.weeklyNew) {
    return { ok: false, reason: "weekly_limit" };
  }

  if (counts.pending >= limits.pendingMax) {
    return { ok: false, reason: "pending_limit" };
  }

  if (
    tier === "pro" &&
    target.isTopTalent &&
    limits.topTalentDaily != null &&
    counts.topTalentLast24h >= limits.topTalentDaily
  ) {
    return {
      ok: false,
      reason: "top_talent_daily_limit",
      retryAfter: bangkokDayRange(now).end,
    };
  }

  if (openerLength > limits.openerMaxChars) {
    return { ok: false, reason: "opener_too_long" };
  }

  if (hasOpeningAttached && !limits.canAttachOpening) {
    return { ok: false, reason: "opening_attach_requires_pro" };
  }

  return { ok: true, limits };
}

export function workerInboundDecision(input: {
  deliveredToday: number;
  limit: number;
  paused: boolean;
}): "deliver" | "queue" {
  if (input.paused) return "queue";
  if (input.deliveredToday >= input.limit) return "queue";
  return "deliver";
}

export function resolveWorkerInboundLimit(
  prefLimit: number | null,
  settings: MessagingSettings
): number {
  const max = settings.workerInboundDailyDefault;
  if (prefLimit == null || Number.isNaN(prefLimit)) {
    return max;
  }
  return Math.min(max, Math.max(1, Math.floor(prefLimit)));
}
