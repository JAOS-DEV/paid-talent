import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import { acceptRequest } from "@/lib/contact-requests";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await context.params;
    const result = await acceptRequest(actor.user.userId, id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      request: {
        id: result.request.id,
        status: result.request.status,
        respondedAt: result.request.respondedAt,
      },
      conversation: {
        id: result.conversation.id,
        contactRequestId: result.conversation.contactRequestId,
      },
    });
  } catch (error) {
    console.error("[ContactRequests] accept failed:", error);
    return NextResponse.json(
      { error: "Failed to accept contact request" },
      { status: 500 }
    );
  }
}
