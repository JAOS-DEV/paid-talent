import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/stripe";
import { getBillingAccessMode } from "@/lib/platform-settings";
import {
  countLaunchDiscountSeatsUsed,
  getBillingPriceSettings,
  priceIdForProduct,
  type BillingProduct,
} from "@/lib/billing/price-settings";
import {
  deniedVerifiedRecruiterResponse,
  requireVerifiedRecruiter,
} from "@/lib/recruiter-access";
import { db, subscriptions, topTalentPasses } from "@/lib/db";
import { isPaidSubscriptionActive } from "@/lib/entitlements";

const bodySchema = z.object({
  product: z.enum(["monthly", "annual", "pass_7d"]).default("monthly"),
});

async function hasActivePaidSubscription(userId: string): Promise<boolean> {
  const [sub] = await db
    .select({
      status: subscriptions.status,
      plan: subscriptions.plan,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      stripeCustomerId: subscriptions.stripeCustomerId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub) return false;

  return isPaidSubscriptionActive({
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeBacked: Boolean(sub.stripeCustomerId || sub.stripeSubscriptionId),
  });
}

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireVerifiedRecruiter();
    if (!actor.ok) {
      return deniedVerifiedRecruiterResponse(actor);
    }
    if (!actor.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const billingMode = await getBillingAccessMode();
    if (billingMode === "open_access") {
      return NextResponse.json(
        {
          error:
            "Checkout is unavailable while premium access is in Open Access mode.",
          billingAccessMode: billingMode,
        },
        { status: 409 }
      );
    }

    let product: BillingProduct = "monthly";
    try {
      const json: unknown = await request.json();
      const parsed = bodySchema.safeParse(json ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid product", reason: "invalid_product" },
          { status: 400 }
        );
      }
      product = parsed.data.product;
    } catch {
      // Empty body defaults to monthly for backwards compatibility
      product = "monthly";
    }

    const settings = await getBillingPriceSettings();
    const priceId = priceIdForProduct(settings, product);
    if (!priceId) {
      return NextResponse.json(
        {
          error: "Price is not configured for this product",
          reason: "price_not_configured",
          product,
        },
        { status: 503 }
      );
    }

    const activeSub = await hasActivePaidSubscription(actor.user.userId);
    if (activeSub) {
      return NextResponse.json(
        {
          error:
            "You already have an active subscription. Use the billing portal to change plans.",
          reason: "active_subscription",
        },
        { status: 409 }
      );
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const successUrl = `${origin}/recruiter/dashboard?subscription=success`;
    const cancelUrl = `${origin}/recruiter/dashboard?subscription=cancelled`;

    const metadata: Record<string, string> = {
      userId: actor.user.userId,
      product,
    };

    let mode: "subscription" | "payment" = "subscription";
    const discounts: Array<{ coupon: string }> = [];

    if (product === "pass_7d") {
      mode = "payment";
      const firstPass = !(await userHasAnyPass(actor.user.userId));
      metadata.firstPass = firstPass ? "1" : "0";
      if (firstPass && settings.firstPassCouponId) {
        discounts.push({ coupon: settings.firstPassCouponId });
      }
    } else if (product === "monthly") {
      const seatsUsed = await countLaunchDiscountSeatsUsed();
      const neverUsedLaunch = !(await userEverHadLaunchDiscount(
        actor.user.userId
      ));
      if (
        settings.launchEnabled &&
        settings.launchCouponId &&
        seatsUsed < settings.launchSeatsLimit &&
        neverUsedLaunch
      ) {
        discounts.push({ coupon: settings.launchCouponId });
        metadata.launch = "1";
      }
    }

    const { url, sessionId } = await createCheckoutSession({
      userId: actor.user.userId,
      userEmail: actor.user.email,
      priceId,
      mode,
      successUrl,
      cancelUrl,
      metadata,
      discounts: discounts.length > 0 ? discounts : undefined,
    });

    return NextResponse.json({ url, sessionId });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
