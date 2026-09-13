import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession, STRIPE_PLANS } from "@/lib/stripe";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Only recruiters can subscribe to Top Talent" },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const successUrl = `${origin}/recruiter/dashboard?subscription=success`;
    const cancelUrl = `${origin}/recruiter/dashboard?subscription=cancelled`;

    const { url, sessionId } = await createCheckoutSession(
      session.user.id,
      session.user.email,
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
