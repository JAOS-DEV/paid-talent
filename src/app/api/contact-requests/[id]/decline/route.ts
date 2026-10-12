import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import { declineRequest } from "@/lib/contact-requests";

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
    const result = await declineRequest(actor.user.userId, id);

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
    });
  } catch (error) {
    console.error("[ContactRequests] decline failed:", error);
    return NextResponse.json(
      { error: "Failed to decline contact request" },
      { status: 500 }
    );
  }
}
