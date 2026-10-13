import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { hideConversation } from "@/lib/conversations";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await context.params;
    const result = await hideConversation(actor.user.userId, id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Conversations] hide failed:", error);
    return NextResponse.json(
      { error: "Failed to hide conversation" },
      { status: 500 }
    );
  }
}
