import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import { hideRequest } from "@/lib/contact-requests";

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
    const result = await hideRequest(actor.user.userId, id);

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
        workerHiddenAt: result.request.workerHiddenAt,
      },
    });
  } catch (error) {
    console.error("[ContactRequests] hide failed:", error);
    return NextResponse.json(
      { error: "Failed to hide contact request" },
      { status: 500 }
    );
  }
}
