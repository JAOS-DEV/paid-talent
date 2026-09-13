import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe, handleWebhookEvent } from "@/lib/stripe";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!stripe) {
      console.log("[Stripe Webhook] Stripe not configured - stub mode");
      return NextResponse.json({ received: true, mode: "stub" });
    }

    if (!webhookSecret) {
      console.warn("[Stripe Webhook] No webhook secret configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const result = await handleWebhookEvent(event);

    if (!result.handled) {
      console.error("[Stripe Webhook] Event handling failed:", result.error);
    }

    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
