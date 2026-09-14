import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createPortalSession } from "@/lib/stripe";
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

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const returnUrl = `${origin}/recruiter/dashboard`;

    const { url } = await createPortalSession(actor.user.userId, returnUrl);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
