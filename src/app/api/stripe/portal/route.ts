import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const returnUrl = `${origin}/recruiter/dashboard`;

    const { url } = await createPortalSession(session.user.id, returnUrl);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
