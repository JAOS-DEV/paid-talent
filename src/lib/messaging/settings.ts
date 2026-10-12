import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbClient } from "@/lib/db";
import {
  MESSAGING_SETTINGS_ID,
  messagingSettings,
  type MessagingSetting,
} from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

const CACHE_TTL_MS = 5_000;

const LIMIT_INT = z.number().int().min(0).max(1000);
const CHAR_INT = z.number().int().min(0).max(5000);
const RETENTION_INT = z.number().int().min(30).max(3650);

export const messagingSettingsFieldsSchema = z.object({
  freeDailyNew: LIMIT_INT,
  freeWeeklyNew: LIMIT_INT,
  freePendingMax: LIMIT_INT,
  freeOpenerMaxChars: CHAR_INT,
  freeCanAttachOpening: z.boolean(),
  freeMaxVenues: LIMIT_INT,
  paidDailyNew: LIMIT_INT,
  paidWeeklyNew: LIMIT_INT,
  paidDailyTopTalent: LIMIT_INT,
  paidPendingMax: LIMIT_INT,
  paidOpenerMaxChars: CHAR_INT,
  paidMaxVenues: LIMIT_INT,
  newRecruiterDailyCap: LIMIT_INT,
  newRecruiterWindowDays: LIMIT_INT,
  workerInboundDailyDefault: LIMIT_INT,
  followUpAfterHours: LIMIT_INT,
  requestExpiryDays: LIMIT_INT,
  declineCooldownDays: LIMIT_INT,
  messageMaxChars: CHAR_INT,
  autoPauseReportThreshold: LIMIT_INT,
  autoPauseWindowDays: LIMIT_INT,
  notifyCooldownMinutes: LIMIT_INT,
  lineMonthlyPushBudget: LIMIT_INT,
  retentionDays: RETENTION_INT,
});

export const messagingSettingsPatchSchema = messagingSettingsFieldsSchema
  .partial()
  .superRefine((data, ctx) => {
    const freeDaily = data.freeDailyNew;
    const freeWeekly = data.freeWeeklyNew;
    if (
      freeDaily !== undefined &&
      freeWeekly !== undefined &&
      freeDaily > freeWeekly
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["freeDailyNew"],
        message: "freeDailyNew must be ≤ freeWeeklyNew",
      });
    }

    const paidDaily = data.paidDailyNew;
    const paidWeekly = data.paidWeeklyNew;
    if (
      paidDaily !== undefined &&
      paidWeekly !== undefined &&
      paidDaily > paidWeekly
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paidDailyNew"],
        message: "paidDailyNew must be ≤ paidWeeklyNew",
      });
    }

    const paidTopTalent = data.paidDailyTopTalent;
    if (
      paidTopTalent !== undefined &&
      paidDaily !== undefined &&
      paidTopTalent > paidDaily
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paidDailyTopTalent"],
        message: "paidDailyTopTalent must be ≤ paidDailyNew",
      });
    }

    const newRecruiterCap = data.newRecruiterDailyCap;
    if (
      newRecruiterCap !== undefined &&
      paidDaily !== undefined &&
      newRecruiterCap > paidDaily
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["newRecruiterDailyCap"],
        message: "newRecruiterDailyCap must be ≤ paidDailyNew",
      });
    }
  });

export type MessagingSettings = z.infer<typeof messagingSettingsFieldsSchema>;
export type MessagingSettingsPatch = z.infer<typeof messagingSettingsPatchSchema>;

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  freeDailyNew: 3,
  freeWeeklyNew: 10,
  freePendingMax: 5,
  freeOpenerMaxChars: 300,
  freeCanAttachOpening: false,
  freeMaxVenues: 1,
  paidDailyNew: 20,
  paidWeeklyNew: 100,
  paidDailyTopTalent: 10,
  paidPendingMax: 25,
  paidOpenerMaxChars: 1000,
  paidMaxVenues: 5,
  newRecruiterDailyCap: 5,
  newRecruiterWindowDays: 7,
  workerInboundDailyDefault: 10,
  followUpAfterHours: 48,
  requestExpiryDays: 14,
  declineCooldownDays: 30,
  messageMaxChars: 2000,
  autoPauseReportThreshold: 3,
  autoPauseWindowDays: 30,
  notifyCooldownMinutes: 15,
  lineMonthlyPushBudget: 300,
  retentionDays: 180,
};

export interface MessagingSettingsSnapshot extends MessagingSettings {
  id: string;
  updatedAt: Date;
  updatedBy: string | null;
}

interface CacheEntry {
  settings: MessagingSettingsSnapshot;
  expiresAt: number;
}

let settingsCache: CacheEntry | null = null;

export function invalidateMessagingSettingsCache(): void {
  settingsCache = null;
}

function rowToSettings(row: MessagingSetting): MessagingSettings {
  return {
    freeDailyNew: row.freeDailyNew,
    freeWeeklyNew: row.freeWeeklyNew,
    freePendingMax: row.freePendingMax,
    freeOpenerMaxChars: row.freeOpenerMaxChars,
    freeCanAttachOpening: row.freeCanAttachOpening,
    freeMaxVenues: row.freeMaxVenues,
    paidDailyNew: row.paidDailyNew,
    paidWeeklyNew: row.paidWeeklyNew,
    paidDailyTopTalent: row.paidDailyTopTalent,
    paidPendingMax: row.paidPendingMax,
    paidOpenerMaxChars: row.paidOpenerMaxChars,
    paidMaxVenues: row.paidMaxVenues,
    newRecruiterDailyCap: row.newRecruiterDailyCap,
    newRecruiterWindowDays: row.newRecruiterWindowDays,
    workerInboundDailyDefault: row.workerInboundDailyDefault,
    followUpAfterHours: row.followUpAfterHours,
    requestExpiryDays: row.requestExpiryDays,
    declineCooldownDays: row.declineCooldownDays,
    messageMaxChars: row.messageMaxChars,
    autoPauseReportThreshold: row.autoPauseReportThreshold,
    autoPauseWindowDays: row.autoPauseWindowDays,
    notifyCooldownMinutes: row.notifyCooldownMinutes,
    lineMonthlyPushBudget: row.lineMonthlyPushBudget,
    retentionDays: row.retentionDays,
  };
}

function toSnapshot(row: MessagingSetting): MessagingSettingsSnapshot {
  return {
    id: row.id,
    ...rowToSettings(row),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

async function ensureMessagingSettingsRow(client: DbClient = db): Promise<void> {
  await client
    .insert(messagingSettings)
    .values({
      id: MESSAGING_SETTINGS_ID,
      ...DEFAULT_MESSAGING_SETTINGS,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: messagingSettings.id });
}

function diffChangedFields(
  before: MessagingSettings,
  after: MessagingSettings
): {
  before: Partial<MessagingSettings>;
  after: Partial<MessagingSettings>;
} {
  const beforeDiff: Partial<MessagingSettings> = {};
  const afterDiff: Partial<MessagingSettings> = {};

  for (const key of Object.keys(DEFAULT_MESSAGING_SETTINGS) as Array<
    keyof MessagingSettings
  >) {
    if (before[key] !== after[key]) {
      (beforeDiff as Record<string, unknown>)[key] = before[key];
      (afterDiff as Record<string, unknown>)[key] = after[key];
    }
  }

  return { before: beforeDiff, after: afterDiff };
}

/**
 * Validate a full merged settings object (patch applied onto current).
 * Used so cross-field rules see both patched and unchanged values.
 */
export function validateMessagingSettingsMerge(
  current: MessagingSettings,
  patch: MessagingSettingsPatch
):
  | { ok: true; merged: MessagingSettings }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const merged = { ...current, ...patch };
  const parsed = messagingSettingsFieldsSchema
    .superRefine((data, ctx) => {
      if (data.freeDailyNew > data.freeWeeklyNew) {
        ctx.addIssue({
          code: "custom",
          path: ["freeDailyNew"],
          message: "freeDailyNew must be ≤ freeWeeklyNew",
        });
      }
      if (data.paidDailyNew > data.paidWeeklyNew) {
        ctx.addIssue({
          code: "custom",
          path: ["paidDailyNew"],
          message: "paidDailyNew must be ≤ paidWeeklyNew",
        });
      }
      if (data.paidDailyTopTalent > data.paidDailyNew) {
        ctx.addIssue({
          code: "custom",
          path: ["paidDailyTopTalent"],
          message: "paidDailyTopTalent must be ≤ paidDailyNew",
        });
      }
      if (data.newRecruiterDailyCap > data.paidDailyNew) {
        ctx.addIssue({
          code: "custom",
          path: ["newRecruiterDailyCap"],
          message: "newRecruiterDailyCap must be ≤ paidDailyNew",
        });
      }
    })
    .safeParse(merged);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  return { ok: true, merged: parsed.data };
}

export async function getMessagingSettings(
  nowMs: number = Date.now()
): Promise<MessagingSettingsSnapshot> {
  if (settingsCache && settingsCache.expiresAt > nowMs) {
    return settingsCache.settings;
  }

  await ensureMessagingSettingsRow();

  const [row] = await db
    .select()
    .from(messagingSettings)
    .where(eq(messagingSettings.id, MESSAGING_SETTINGS_ID))
    .limit(1);

  if (!row) {
    const fallback: MessagingSettingsSnapshot = {
      id: MESSAGING_SETTINGS_ID,
      ...DEFAULT_MESSAGING_SETTINGS,
      updatedAt: new Date(),
      updatedBy: null,
    };
    settingsCache = { settings: fallback, expiresAt: nowMs + CACHE_TTL_MS };
    return fallback;
  }

  const settings = toSnapshot(row);
  settingsCache = { settings, expiresAt: nowMs + CACHE_TTL_MS };
  return settings;
}

export async function updateMessagingSettings(input: {
  patch: MessagingSettingsPatch;
  reason: string;
  adminEmail: string;
  adminUserId?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; settings: MessagingSettingsSnapshot }
  | {
      ok: false;
      status: number;
      error: string;
      fieldErrors?: Record<string, string[]>;
    }
> {
  const now = input.now ?? new Date();

  const result = await db.transaction(async (tx) => {
    const client = tx as DbClient;
    await ensureMessagingSettingsRow(client);

    const [before] = await client
      .select()
      .from(messagingSettings)
      .where(eq(messagingSettings.id, MESSAGING_SETTINGS_ID))
      .limit(1);

    if (!before) {
      return {
        ok: false as const,
        status: 500,
        error: "Messaging settings row missing",
      };
    }

    const beforeSettings = rowToSettings(before);
    const validation = validateMessagingSettingsMerge(
      beforeSettings,
      input.patch
    );
    if (!validation.ok) {
      return {
        ok: false as const,
        status: 400,
        error: "Invalid messaging settings",
        fieldErrors: validation.fieldErrors,
      };
    }

    const [updated] = await client
      .update(messagingSettings)
      .set({
        ...input.patch,
        updatedAt: now,
        updatedBy: input.adminEmail,
      })
      .where(eq(messagingSettings.id, MESSAGING_SETTINGS_ID))
      .returning();

    if (!updated) {
      return {
        ok: false as const,
        status: 500,
        error: "Failed to update messaging settings",
      };
    }

    const afterSettings = rowToSettings(updated);
    const changed = diffChangedFields(beforeSettings, afterSettings);

    if (Object.keys(changed.after).length > 0) {
      await recordAdminAuditEvent({
        action: "messaging_settings_changed",
        actorAdminEmail: input.adminEmail,
        actorUserId: input.adminUserId ?? null,
        targetType: "platform_setting",
        targetId: "messaging_settings",
        reason: input.reason,
        metadata: {
          before: changed.before,
          after: changed.after,
        },
        createdAt: now,
        db: client,
      });
    }

    return {
      ok: true as const,
      settings: toSnapshot(updated),
    };
  });

  if (result.ok) {
    invalidateMessagingSettingsCache();
  }

  return result;
}
