import { and, eq } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import {
  PLATFORM_SETTINGS_ID,
  platformSettings,
  type BillingAccessMode,
} from "@/lib/db/schema";
import {
  DEFAULT_BILLING_ACCESS_MODE,
  isBillingAccessMode,
} from "./mode";
import { recordAdminAuditEvent } from "@/lib/admin/audit";

const CACHE_TTL_MS = 5_000;
const STALE_MODE_ERROR =
  "Paywall mode changed since this page loaded. Refresh and try again.";

interface BillingModeCache {
  mode: BillingAccessMode;
  expiresAt: number;
}

let billingModeCache: BillingModeCache | null = null;

export function invalidateBillingAccessModeCache(): void {
  billingModeCache = null;
}

async function ensurePlatformSettingsRow(client: DbClient = db): Promise<void> {
  await client
    .insert(platformSettings)
    .values({
      id: PLATFORM_SETTINGS_ID,
      billingAccessMode: DEFAULT_BILLING_ACCESS_MODE,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: platformSettings.id });
}

export async function getBillingAccessMode(
  nowMs: number = Date.now()
): Promise<BillingAccessMode> {
  if (billingModeCache && billingModeCache.expiresAt > nowMs) {
    return billingModeCache.mode;
  }

  await ensurePlatformSettingsRow();

  const [row] = await db
    .select({
      billingAccessMode: platformSettings.billingAccessMode,
    })
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const mode = isBillingAccessMode(row?.billingAccessMode)
    ? row.billingAccessMode
    : DEFAULT_BILLING_ACCESS_MODE;

  billingModeCache = {
    mode,
    expiresAt: nowMs + CACHE_TTL_MS,
  };

  return mode;
}

export async function getPlatformBillingSettings(): Promise<{
  mode: BillingAccessMode;
  reason: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}> {
  await ensurePlatformSettingsRow();

  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  if (!row) {
    return {
      mode: DEFAULT_BILLING_ACCESS_MODE,
      reason: null,
      updatedAt: null,
      updatedBy: null,
    };
  }

  return {
    mode: row.billingAccessMode,
    reason: row.billingAccessModeReason,
    updatedAt: row.billingAccessModeUpdatedAt,
    updatedBy: row.billingAccessModeUpdatedBy,
  };
}

export async function updateBillingAccessMode(input: {
  nextMode: BillingAccessMode;
  previousMode: BillingAccessMode;
  reason: string;
  adminEmail: string;
  adminUserId?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; mode: BillingAccessMode }
  | { ok: false; status: number; error: string }
> {
  const now = input.now ?? new Date();

  const result = await db.transaction(async (tx) => {
    const client = tx as DbClient;
    await ensurePlatformSettingsRow(client);

    const [updated] = await client
      .update(platformSettings)
      .set({
        billingAccessMode: input.nextMode,
        billingAccessModeReason: input.reason,
        billingAccessModeUpdatedAt: now,
        billingAccessModeUpdatedBy: input.adminEmail,
        updatedAt: now,
      })
      .where(
        and(
          eq(platformSettings.id, PLATFORM_SETTINGS_ID),
          eq(platformSettings.billingAccessMode, input.previousMode)
        )
      )
      .returning({
        billingAccessMode: platformSettings.billingAccessMode,
      });

    if (!updated) {
      return {
        ok: false as const,
        status: 409,
        error: STALE_MODE_ERROR,
      };
    }

    if (input.previousMode !== updated.billingAccessMode) {
      await recordAdminAuditEvent({
        action: "subscription_paywall_mode_changed",
        actorAdminEmail: input.adminEmail,
        actorUserId: input.adminUserId ?? null,
        targetType: "platform_setting",
        targetId: "billing_access_mode",
        reason: input.reason,
        metadata: {
          before: input.previousMode,
          after: updated.billingAccessMode,
        },
        createdAt: now,
        db: client,
      });
    }

    return {
      ok: true as const,
      mode: updated.billingAccessMode,
    };
  });

  if (result.ok) {
    invalidateBillingAccessModeCache();
  }

  return result;
}

export {
  DEFAULT_BILLING_ACCESS_MODE,
  describeBillingAccessMode,
  isBillingAccessMode,
} from "./mode";
