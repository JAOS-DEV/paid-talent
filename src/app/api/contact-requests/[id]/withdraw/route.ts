import { NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { withdrawRequest } from "@/lib/contact-requests";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await context.params;
    const result = await withdrawRequest(actor.user.userId, id);

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
      },
    });
  } catch (error) {
    console.error("[ContactRequests] withdraw failed:", error);
    return NextResponse.json(
      { error: "Failed to withdraw contact request" },
      { status: 500 }
    );
  }
}
