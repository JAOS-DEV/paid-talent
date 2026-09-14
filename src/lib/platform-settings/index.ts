import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  PLATFORM_SETTINGS_ID,
  platformSettings,
  type BillingAccessMode,
} from "@/lib/db/schema";
import {
  DEFAULT_BILLING_ACCESS_MODE,
  isBillingAccessMode,
} from "./mode";

const CACHE_TTL_MS = 5_000;

interface BillingModeCache {
  mode: BillingAccessMode;
  expiresAt: number;
}

let billingModeCache: BillingModeCache | null = null;

export function invalidateBillingAccessModeCache(): void {
  billingModeCache = null;
}

async function ensurePlatformSettingsRow(): Promise<void> {
  await db
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
  now?: Date;
}): Promise<
  | { ok: true; mode: BillingAccessMode }
  | { ok: false; status: number; error: string }
> {
  const now = input.now ?? new Date();
  await ensurePlatformSettingsRow();
  const current = await getPlatformBillingSettings();

  if (current.mode !== input.previousMode) {
    return {
      ok: false,
      status: 409,
      error: "Paywall mode changed since this page loaded. Refresh and try again.",
    };
  }

  if (current.mode === input.nextMode) {
    invalidateBillingAccessModeCache();
    return { ok: true, mode: current.mode };
  }

  const [updated] = await db
    .update(platformSettings)
    .set({
      billingAccessMode: input.nextMode,
      billingAccessModeReason: input.reason,
      billingAccessModeUpdatedAt: now,
      billingAccessModeUpdatedBy: input.adminEmail,
      updatedAt: now,
    })
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .returning({
      billingAccessMode: platformSettings.billingAccessMode,
    });

  if (!updated || updated.billingAccessMode !== input.nextMode) {
    return {
      ok: false,
      status: 409,
      error: "Paywall mode changed since this page loaded. Refresh and try again.",
    };
  }

  invalidateBillingAccessModeCache();
  return { ok: true, mode: updated.billingAccessMode };
}

export {
  DEFAULT_BILLING_ACCESS_MODE,
  describeBillingAccessMode,
  isBillingAccessMode,
} from "./mode";
