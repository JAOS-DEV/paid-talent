import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { getConversation } from "@/lib/conversations";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await context.params;
    const beforeParam = request.nextUrl.searchParams.get("before");
    const before = beforeParam ? new Date(beforeParam) : undefined;
    if (beforeParam && Number.isNaN(before?.getTime())) {
      return NextResponse.json({ error: "Invalid before parameter" }, { status: 400 });
    }

    const role = actor.user.role as "worker" | "recruiter";
    const result = await getConversation(actor.user.userId, id, role, {
      before,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({ conversation: result.conversation });
  } catch (error) {
    console.error("[Conversations] get failed:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}
