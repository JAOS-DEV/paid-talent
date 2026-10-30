import Stripe from "stripe";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, subscriptions, topTalentPasses } from "@/lib/db";
import type { BillingProduct } from "@/lib/db/schema";
import { getEffectiveEntitlement } from "@/lib/entitlements";
import {
  getBillingPriceSettings,
  priceIdForProduct,
} from "@/lib/billing/price-settings";
import { stripe } from "./client";
import { addUtcDays } from "@/lib/entitlements/resolve";

export { isStripeConfigured, stripe } from "./client";

export const STRIPE_PLANS = {
  TOP_TALENT_UNLOCK: {
    name: "Top Talent Unlock",
    priceId: process.env.STRIPE_TOP_TALENT_PRICE_ID || "price_top_talent_stub",
    description: "Message Top Talent",
    features: [
      "Message Top Talent",
      "Higher daily contact-request limits",
      "Priority in the talent's inbox with a Verified Pro badge",
      "Longer opening message with an opening attached",
    ],
  },
} as const;

function appendQueryParam(rawUrl: string, key: string, value: string): string {
  const absolute = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl);
  const url = new URL(rawUrl, "http://localhost");
  url.searchParams.set(key, value);
  if (absolute) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export interface CreateCheckoutSessionInput {
  userId: string;
  userEmail: string;
  priceId: string;
  mode: "subscription" | "payment";
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  discounts?: Array<{ coupon: string }>;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<{ url: string | null; sessionId: string }> {
  const {
    userId,
    userEmail,
    priceId,
    mode,
    successUrl,
    cancelUrl,
    metadata,
    discounts,
  } = input;

  if (!stripe) {
    console.log("[Stripe Stub] Creating mock checkout session");
    const sessionId = `stub_session_${Date.now()}`;
    return {
      url: appendQueryParam(successUrl, "session_id", sessionId),
      sessionId,
    };
  }

  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  let customerId = existingSub?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    ...(discounts && discounts.length > 0 ? { discounts } : {}),
  });

  return { url: session.url, sessionId: session.id };
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<{ url: string }> {
  if (!stripe) {
    console.log("[Stripe Stub] Creating mock portal session");
    return { url: returnUrl };
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    throw new Error("No subscription found for user");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function handleWebhookEvent(
  event: Stripe.Event
): Promise<{ handled: boolean; error?: string }> {
  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return { handled: true };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);
    return {
      handled: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function metadataProduct(
  metadata: Stripe.Metadata | null | undefined
): BillingProduct | null {
  const product = metadata?.product;
  if (product === "monthly" || product === "annual" || product === "pass_7d") {
    return product;
  }
  return null;
}

async function resolveSubscriptionPriceId(
  session: Stripe.Checkout.Session,
  product: BillingProduct | null
): Promise<string | null> {
  if (stripe && session.subscription) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id,
        { expand: ["items.data.price"] }
      );
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId) return priceId;
    } catch (error) {
      console.error("[Stripe] Failed to retrieve subscription for price:", error);
    }
  }

  if (product) {
    const settings = await getBillingPriceSettings();
    return priceIdForProduct(settings, product);
  }

  return null;
}

async function resolveSubscriptionPeriod(subscriptionId: string | null): Promise<{
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}> {
  if (!stripe || !subscriptionId) {
    return {};
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const start =
      "current_period_start" in subscription
        ? new Date(
            (subscription as { current_period_start: number }).current_period_start *
              1000
          )
        : undefined;
    const end =
      "current_period_end" in subscription
        ? new Date(
            (subscription as { current_period_end: number }).current_period_end * 1000
          )
        : undefined;
    return { currentPeriodStart: start, currentPeriodEnd: end };
  } catch (error) {
    console.error("[Stripe] Failed to retrieve subscription period:", error);
    return {};
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[Stripe] No userId in checkout session metadata");
    return;
  }

  const product = metadataProduct(session.metadata);

  if (session.mode === "payment" && product === "pass_7d") {
    if (session.payment_status !== "paid") {
      console.log(
        `[Stripe] Pass checkout ${session.id} not paid (${session.payment_status})`
      );
      return;
    }
    await handlePassCheckoutCompleted(session, userId);
    return;
  }

  if (session.mode !== "subscription") {
    console.log(`[Stripe] Ignoring checkout mode ${session.mode}`);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const stripePriceId = await resolveSubscriptionPriceId(session, product);
  const period = await resolveSubscriptionPeriod(subscriptionId);
  const launchDiscountApplied = session.metadata?.launch === "1";
  const billingProduct =
    product === "monthly" || product === "annual" ? product : null;

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId,
      status: "active",
      plan: "top_talent_unlock",
      billingProduct,
      launchDiscountApplied,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId,
        status: "active",
        plan: "top_talent_unlock",
        billingProduct,
        launchDiscountApplied,
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
        updatedAt: new Date(),
      },
    });

  console.log(`[Stripe] Subscription activated for user ${userId}`);
}

async function handlePassCheckoutCompleted(
  session: Stripe.Checkout.Session,
  userId: string
): Promise<void> {
  const now = new Date();
  const [latestActive] = await db
    .select({ expiresAt: topTalentPasses.expiresAt })
    .from(topTalentPasses)
    .where(
      and(eq(topTalentPasses.userId, userId), gt(topTalentPasses.expiresAt, now))
    )
    .orderBy(desc(topTalentPasses.expiresAt))
    .limit(1);

  const startsAt =
    latestActive && latestActive.expiresAt > now ? latestActive.expiresAt : now;
  const expiresAt = addUtcDays(startsAt, 7);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  await db
    .insert(topTalentPasses)
    .values({
      userId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      usedFirstPassCoupon: session.metadata?.firstPass === "1",
      startsAt,
      expiresAt,
      createdAt: now,
    })
    .onConflictDoNothing({ target: topTalentPasses.stripeCheckoutSessionId });

  console.log(`[Stripe] 7-day pass created for user ${userId}`);
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const status = subscription.status as
    | "active"
    | "canceled"
    | "past_due"
    | "incomplete"
    | "trialing";

  const currentPeriodStart =
    "current_period_start" in subscription
      ? new Date(
          (subscription as { current_period_start: number }).current_period_start *
            1000
        )
      : undefined;
  const currentPeriodEnd =
    "current_period_end" in subscription
      ? new Date(
          (subscription as { current_period_end: number }).current_period_end * 1000
        )
      : undefined;

  const priceId = subscription.items.data[0]?.price?.id;

  await db
    .update(subscriptions)
    .set({
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(priceId ? { stripePriceId: priceId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  console.log(`[Stripe] Subscription ${subscription.id} updated to ${status}`);
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      plan: "free",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  console.log(`[Stripe] Subscription ${subscription.id} deleted`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    "subscription" in invoice
      ? (invoice as { subscription?: string }).subscription
      : undefined;
  if (!subscriptionId) return;

  await db
    .update(subscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  console.log(`[Stripe] Payment failed for subscription ${subscriptionId}`);
}

export async function hasTopTalentAccess(userId: string): Promise<boolean> {
  const entitlement = await getEffectiveEntitlement(userId);
  return entitlement.hasPremiumAccess;
}

export async function getSubscriptionStatus(userId: string): Promise<{
  hasSubscription: boolean;
  plan: string;
  status: string;
  canAccessTopTalent: boolean;
  billingAccessMode: "enforced" | "open_access";
  entitlementSources: string[];
  paidAccess: boolean;
  adminGrantAccess: boolean;
} | null> {
  const entitlement = await getEffectiveEntitlement(userId);
  const sub = entitlement.paidSubscription;

  if (!sub) {
    return {
      hasSubscription: false,
      plan: "free",
      status: "none",
      canAccessTopTalent: entitlement.hasPremiumAccess,
      billingAccessMode: entitlement.billingAccessMode,
      entitlementSources: entitlement.sources,
      paidAccess: false,
      adminGrantAccess: entitlement.adminGrantAccess,
    };
  }

  return {
    hasSubscription: true,
    plan: sub.plan,
    status: sub.status,
    canAccessTopTalent: entitlement.hasPremiumAccess,
    billingAccessMode: entitlement.billingAccessMode,
    entitlementSources: entitlement.sources,
    paidAccess: entitlement.paidAccess,
    adminGrantAccess: entitlement.adminGrantAccess,
  };
}
