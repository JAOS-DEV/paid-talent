import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { getAdminConversationView } from "@/lib/admin/conversation-viewer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") ?? "";

    const result = await getAdminConversationView({
      conversationId: id,
      reason,
      actorUserId: guard.actor.userId,
      actorEmail: guard.actor.email,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, reason: result.reason },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("[Admin conversations] view failed:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}
