import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createCheckoutSession, STRIPE_PLANS } from "@/lib/stripe";
import { getBillingAccessMode } from "@/lib/platform-settings";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }
    if (!actor.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const billingMode = await getBillingAccessMode();
    if (billingMode === "open_access") {
      return NextResponse.json(
        {
          error: "Checkout is unavailable while premium access is in Open Access mode.",
          billingAccessMode: billingMode,
        },
        { status: 409 }
      );
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const successUrl = `${origin}/recruiter/dashboard?subscription=success`;
    const cancelUrl = `${origin}/recruiter/dashboard?subscription=cancelled`;

    const { url, sessionId } = await createCheckoutSession(
      actor.user.userId,
      actor.user.email,
      STRIPE_PLANS.TOP_TALENT_UNLOCK.priceId,
      successUrl,
      cancelUrl
    );

    return NextResponse.json({ url, sessionId });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
