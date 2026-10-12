import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  countLaunchDiscountSeatsUsed,
  getBillingPriceSettings,
  type BillingProduct,
} from "@/lib/billing/price-settings";
import { stripe } from "@/lib/stripe/client";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { db, subscriptions, topTalentPasses } from "@/lib/db";

const STUB_AMOUNTS: Record<
  BillingProduct,
  { unitAmount: number; currency: string }
> = {
  monthly: { unitAmount: 99000, currency: "thb" },
  annual: { unitAmount: 990000, currency: "thb" },
  pass_7d: { unitAmount: 39000, currency: "thb" },
};

async function userHasAnyPass(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: topTalentPasses.id })
    .from(topTalentPasses)
    .where(eq(topTalentPasses.userId, userId))
    .limit(1);
  return Boolean(row);
}

async function userEverHadLaunchDiscount(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ launchDiscountApplied: subscriptions.launchDiscountApplied })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.launchDiscountApplied, true)
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const settings = await getBillingPriceSettings();
    const seatsUsed = await countLaunchDiscountSeatsUsed();
    const neverUsedLaunch = !(await userEverHadLaunchDiscount(actor.user.userId));
    const launchAvailable =
      settings.launchEnabled &&
      Boolean(settings.launchCouponId) &&
      seatsUsed < settings.launchSeatsLimit &&
      neverUsedLaunch;
    const firstPassDiscountAvailable =
      Boolean(settings.firstPassCouponId) &&
      !(await userHasAnyPass(actor.user.userId));

    const products: BillingProduct[] = ["monthly", "annual", "pass_7d"];
    const prices = [];

    for (const product of products) {
      const priceId =
        product === "monthly"
          ? settings.monthlyPriceId
          : product === "annual"
            ? settings.annualPriceId
            : settings.pass7dPriceId;

      const stub = STUB_AMOUNTS[product];
      const base = {
        product,
        launchAvailable: product === "monthly" ? launchAvailable : false,
        firstPassDiscountAvailable:
          product === "pass_7d" ? firstPassDiscountAvailable : false,
      };

      if (!stripe || !priceId) {
        prices.push({
          ...base,
          unitAmount: stub.unitAmount,
          currency: stub.currency,
          priceId: priceId ?? null,
          configured: Boolean(priceId),
        });
        continue;
      }

      try {
        const price = await stripe.prices.retrieve(priceId);
        prices.push({
          ...base,
          unitAmount: price.unit_amount ?? stub.unitAmount,
          currency: price.currency,
          priceId,
          configured: true,
        });
      } catch {
        prices.push({
          ...base,
          unitAmount: stub.unitAmount,
          currency: stub.currency,
          priceId,
          configured: true,
        });
      }
    }

    return NextResponse.json({
      prices,
      launchSeatsUsed: seatsUsed,
      launchSeatsLimit: settings.launchSeatsLimit,
      launchEnabled: settings.launchEnabled,
    });
  } catch (error) {
    console.error("[Stripe Prices] Error:", error);
    return NextResponse.json(
      { error: "Failed to load prices" },
      { status: 500 }
    );
  }
}
