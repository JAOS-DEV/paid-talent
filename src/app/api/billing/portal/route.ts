import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/lib/db";
import {
  deniedVerifiedRecruiterResponse,
  requireVerifiedRecruiter,
} from "@/lib/recruiter-access";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const actor = await requireVerifiedRecruiter();
  if (!actor.ok) {
    return deniedVerifiedRecruiterResponse(actor);
  }

  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json(
      { error: "Billing portal is not configured" },
      { status: 503 }
    );
  }

  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, actor.user.userId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer for this account" },
      { status: 403 }
    );
  }

  const origin = request.headers.get("origin") || "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/recruiter/billing`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
