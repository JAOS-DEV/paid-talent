import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lineLinks } from "@/lib/db/schema";
import {
  getLineMessagingChannelSecret,
  isLineMessagingConfigured,
} from "@/lib/line/config";
import { verifyLineWebhookSignature } from "@/lib/line/webhook-signature";

export const runtime = "nodejs";

interface LineWebhookEvent {
  type?: string;
  source?: { type?: string; userId?: string };
}

interface LineWebhookBody {
  events?: LineWebhookEvent[];
}

async function applyFriendStatus(
  lineUserId: string,
  isFriend: boolean
): Promise<void> {
  const now = new Date();
  await db
    .update(lineLinks)
    .set({
      isFriend,
      friendStatusUpdatedAt: now,
    })
    .where(eq(lineLinks.lineUserId, lineUserId));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();

    if (!isLineMessagingConfigured()) {
      return NextResponse.json({ ok: true, mode: "noop" });
    }

    const channelSecret = getLineMessagingChannelSecret();
    const signature = request.headers.get("x-line-signature");

    if (
      !channelSecret ||
      !verifyLineWebhookSignature(body, signature, channelSecret)
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let parsed: LineWebhookBody;
    try {
      parsed = JSON.parse(body) as LineWebhookBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const events = Array.isArray(parsed.events) ? parsed.events : [];

    for (const event of events) {
      const lineUserId = event.source?.userId?.trim();
      if (!lineUserId) continue;

      if (event.type === "follow") {
        await applyFriendStatus(lineUserId, true);
        continue;
      }
      if (event.type === "unfollow") {
        await applyFriendStatus(lineUserId, false);
        continue;
      }
      // Message and all other events: ignore (notification-only OA policy).
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LINE webhook] failed:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
