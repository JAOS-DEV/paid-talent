import { NextResponse } from "next/server";
import { getSubscriptionStatus } from "@/lib/stripe";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const status = await getSubscriptionStatus(actor.user.userId);

    return NextResponse.json(status);
  } catch (error) {
    console.error("[Stripe Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription status" },
      { status: 500 }
    );
  }
}
