import Stripe from "stripe";
import { db, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      typescript: true,
    })
  : null;

export const STRIPE_PLANS = {
  TOP_TALENT_UNLOCK: {
    name: "Top Talent Unlock",
    priceId: process.env.STRIPE_TOP_TALENT_PRICE_ID || "price_top_talent_stub",
    description: "Unlock full contact details for Top Talent workers",
    features: [
      "View LINE, WhatsApp, and phone numbers",
      "Priority in search results",
      "Direct contact with top workers",
    ],
  },
} as const;

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null; sessionId: string }> {
  if (!stripe) {
    console.log("[Stripe Stub] Creating mock checkout session");
    return {
      url: `${successUrl}?session_id=stub_session_${Date.now()}`,
      sessionId: `stub_session_${Date.now()}`,
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
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
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

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[Stripe] No userId in checkout session metadata");
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: "active",
      plan: "top_talent_unlock",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: "active",
        plan: "top_talent_unlock",
        updatedAt: new Date(),
      },
    });

  console.log(`[Stripe] Subscription activated for user ${userId}`);
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

  const currentPeriodStart = "current_period_start" in subscription 
    ? new Date((subscription as { current_period_start: number }).current_period_start * 1000)
    : undefined;
  const currentPeriodEnd = "current_period_end" in subscription
    ? new Date((subscription as { current_period_end: number }).current_period_end * 1000)
    : undefined;

  await db
    .update(subscriptions)
    .set({
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
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
  const subscriptionId = "subscription" in invoice 
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
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return sub?.plan === "top_talent_unlock" && sub?.status === "active";
}

export async function getSubscriptionStatus(userId: string): Promise<{
  hasSubscription: boolean;
  plan: string;
  status: string;
  canAccessTopTalent: boolean;
} | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub) {
    return {
      hasSubscription: false,
      plan: "free",
      status: "none",
      canAccessTopTalent: false,
    };
  }

  return {
    hasSubscription: true,
    plan: sub.plan,
    status: sub.status,
    canAccessTopTalent:
      sub.plan === "top_talent_unlock" && sub.status === "active",
  };
}
