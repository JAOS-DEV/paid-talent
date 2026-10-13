import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { listConversations } from "@/lib/conversations";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const role = actor.user.role as "worker" | "recruiter";
    const result = await listConversations(actor.user.userId, role);

    return NextResponse.json({
      conversations: result.conversations,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error("[Conversations] list failed:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}
