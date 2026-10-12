import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { followUp } from "@/lib/contact-requests";

const followUpSchema = z.object({
  text: z.string().min(1).max(5000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    const validation = followUpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const result = await followUp(
      actor.user.userId,
      id,
      validation.data.text
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
          ...(result.retryAfter
            ? { retryAfter: result.retryAfter.toISOString() }
            : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      request: {
        id: result.request.id,
        followUpText: result.request.followUpText,
        followUpSentAt: result.request.followUpSentAt,
      },
    });
  } catch (error) {
    console.error("[ContactRequests] follow-up failed:", error);
    return NextResponse.json(
      { error: "Failed to send follow-up" },
      { status: 500 }
    );
  }
}
