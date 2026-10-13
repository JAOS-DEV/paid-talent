import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runMessagingMaintenance } from "@/lib/contact-requests";
import { retryPending } from "@/lib/notifications";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const counts = await runMessagingMaintenance();
    const notificationsRetried = await retryPending();
    return NextResponse.json({ ok: true, ...counts, notificationsRetried });
  } catch (error) {
    console.error("[Cron] messaging-maintenance failed:", error);
    return NextResponse.json(
      { error: "Messaging maintenance failed" },
      { status: 500 }
    );
  }
}
