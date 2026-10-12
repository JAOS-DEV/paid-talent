import { count, eq } from "drizzle-orm";
import { db, type DbClient } from "@/lib/db";
import {
  BILLING_PRICE_SETTINGS_ID,
  billingPriceSettings,
  subscriptions,
  type BillingPriceSetting,
} from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { stripe } from "@/lib/stripe/client";

const CACHE_TTL_MS = 5_000;

export type BillingProduct = "monthly" | "annual" | "pass_7d";

export interface BillingPriceSettingsSnapshot {
  id: string;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  pass7dPriceId: string | null;
  launchCouponId: string | null;
  launchEnabled: boolean;
  launchSeatsLimit: number;
  firstPassCouponId: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export type BillingPriceSettingsPatch = {
  monthlyPriceId?: string | null;
  annualPriceId?: string | null;
  pass7dPriceId?: string | null;
  launchCouponId?: string | null;
  launchEnabled?: boolean;
  launchSeatsLimit?: number;
  firstPassCouponId?: string | null;
};

interface CacheEntry {
  settings: BillingPriceSettingsSnapshot;
  expiresAt: number;
}

let settingsCache: CacheEntry | null = null;

export function invalidateBillingPriceSettingsCache(): void {
  settingsCache = null;
}

function toSnapshot(row: BillingPriceSetting): BillingPriceSettingsSnapshot {
  const envMonthly = process.env.STRIPE_TOP_TALENT_PRICE_ID || null;
  return {
    id: row.id,
    monthlyPriceId: row.monthlyPriceId || envMonthly,
    annualPriceId: row.annualPriceId,
    pass7dPriceId: row.pass7dPriceId,
    launchCouponId: row.launchCouponId,
    launchEnabled: row.launchEnabled,
    launchSeatsLimit: row.launchSeatsLimit,
    firstPassCouponId: row.firstPassCouponId,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

async function ensureBillingPriceSettingsRow(
  client: DbClient = db
): Promise<void> {
  await client
    .insert(billingPriceSettings)
    .values({
      id: BILLING_PRICE_SETTINGS_ID,
      monthlyPriceId: process.env.STRIPE_TOP_TALENT_PRICE_ID || null,
      launchEnabled: false,
      launchSeatsLimit: 50,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: billingPriceSettings.id });
}

export async function getBillingPriceSettings(
  nowMs: number = Date.now()
): Promise<BillingPriceSettingsSnapshot> {
  if (settingsCache && settingsCache.expiresAt > nowMs) {
    return settingsCache.settings;
  }

  await ensureBillingPriceSettingsRow();

  const [row] = await db
    .select()
    .from(billingPriceSettings)
    .where(eq(billingPriceSettings.id, BILLING_PRICE_SETTINGS_ID))
    .limit(1);

  if (!row) {
    const fallback: BillingPriceSettingsSnapshot = {
      id: BILLING_PRICE_SETTINGS_ID,
      monthlyPriceId: process.env.STRIPE_TOP_TALENT_PRICE_ID || null,
      annualPriceId: null,
      pass7dPriceId: null,
      launchCouponId: null,
      launchEnabled: false,
      launchSeatsLimit: 50,
      firstPassCouponId: null,
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

export async function countLaunchDiscountSeatsUsed(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(eq(subscriptions.launchDiscountApplied, true));
  return Number(row?.value ?? 0);
}

export function priceIdForProduct(
  settings: BillingPriceSettingsSnapshot,
  product: BillingProduct
): string | null {
  if (product === "monthly") return settings.monthlyPriceId;
  if (product === "annual") return settings.annualPriceId;
  return settings.pass7dPriceId;
}

export async function validatePriceIds(
  patch: BillingPriceSettingsPatch
): Promise<{ ok: true; warnings: string[] } | { ok: false; errors: string[] }> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!stripe) {
    warnings.push(
      "Stripe is not configured (stub mode). Price/coupon IDs were not validated against Stripe."
    );
    return { ok: true, warnings };
  }

  const checkPrice = async (
    id: string | null | undefined,
    label: string,
    expect: { type: "recurring"; interval: "month" | "year" } | { type: "one_time" }
  ): Promise<void> => {
    if (id == null || id === "") return;
    try {
      const price = await stripe!.prices.retrieve(id);
      if (!price.active) {
        errors.push(`${label}: price ${id} is not active`);
      }
      if (price.currency !== "thb") {
        errors.push(`${label}: price ${id} currency must be thb (got ${price.currency})`);
      }
      if (expect.type === "one_time") {
        if (price.type !== "one_time") {
          errors.push(`${label}: price ${id} must be one_time`);
        }
      } else {
        if (price.type !== "recurring" || price.recurring?.interval !== expect.interval) {
          errors.push(
            `${label}: price ${id} must be recurring/${expect.interval}`
          );
        }
      }
    } catch {
      errors.push(`${label}: could not retrieve price ${id}`);
    }
  };

  const checkCoupon = async (
    id: string | null | undefined,
    label: string
  ): Promise<void> => {
    if (id == null || id === "") return;
    try {
      const coupon = await stripe!.coupons.retrieve(id);
      if (!coupon.valid) {
        errors.push(`${label}: coupon ${id} is not valid`);
      }
    } catch {
      errors.push(`${label}: could not retrieve coupon ${id}`);
    }
  };

  await checkPrice(patch.monthlyPriceId, "monthly", {
    type: "recurring",
    interval: "month",
  });
  await checkPrice(patch.annualPriceId, "annual", {
    type: "recurring",
    interval: "year",
  });
  await checkPrice(patch.pass7dPriceId, "pass_7d", { type: "one_time" });
  await checkCoupon(patch.launchCouponId, "launch");
  await checkCoupon(patch.firstPassCouponId, "first_pass");

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, warnings };
}

export async function updateBillingPriceSettings(input: {
  patch: BillingPriceSettingsPatch;
  adminEmail: string;
  adminUserId?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; settings: BillingPriceSettingsSnapshot; warnings: string[] }
  | { ok: false; status: number; error: string; errors?: string[] }
> {
  const validation = await validatePriceIds(input.patch);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: "Invalid Stripe price or coupon configuration",
      errors: validation.errors,
    };
  }

  const now = input.now ?? new Date();

  const result = await db.transaction(async (tx) => {
    const client = tx as DbClient;
    await ensureBillingPriceSettingsRow(client);

    const [before] = await client
      .select()
      .from(billingPriceSettings)
      .where(eq(billingPriceSettings.id, BILLING_PRICE_SETTINGS_ID))
      .limit(1);

    const beforeSnap = before ? toSnapshot(before) : null;

    const [updated] = await client
      .update(billingPriceSettings)
      .set({
        ...(input.patch.monthlyPriceId !== undefined
          ? { monthlyPriceId: input.patch.monthlyPriceId }
          : {}),
        ...(input.patch.annualPriceId !== undefined
          ? { annualPriceId: input.patch.annualPriceId }
          : {}),
        ...(input.patch.pass7dPriceId !== undefined
          ? { pass7dPriceId: input.patch.pass7dPriceId }
          : {}),
        ...(input.patch.launchCouponId !== undefined
          ? { launchCouponId: input.patch.launchCouponId }
          : {}),
        ...(input.patch.launchEnabled !== undefined
          ? { launchEnabled: input.patch.launchEnabled }
          : {}),
        ...(input.patch.launchSeatsLimit !== undefined
          ? { launchSeatsLimit: input.patch.launchSeatsLimit }
          : {}),
        ...(input.patch.firstPassCouponId !== undefined
          ? { firstPassCouponId: input.patch.firstPassCouponId }
          : {}),
        updatedAt: now,
        updatedBy: input.adminEmail,
      })
      .where(eq(billingPriceSettings.id, BILLING_PRICE_SETTINGS_ID))
      .returning();

    if (!updated) {
      return {
        ok: false as const,
        status: 500,
        error: "Failed to update billing price settings",
      };
    }

    const afterSnap = toSnapshot(updated);

    await recordAdminAuditEvent({
      action: "billing_prices_changed",
      actorAdminEmail: input.adminEmail,
      actorUserId: input.adminUserId ?? null,
      targetType: "platform_setting",
      targetId: "billing_price_settings",
      metadata: {
        before: beforeSnap,
        after: afterSnap,
      },
      createdAt: now,
      db: client,
    });

    return {
      ok: true as const,
      settings: afterSnap,
      warnings: validation.warnings,
    };
  });

  if (result.ok) {
    invalidateBillingPriceSettingsCache();
  }

  return result;
}
