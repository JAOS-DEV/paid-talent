import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { sendMessage } from "@/lib/conversations";

const bodySchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid message body" }, { status: 400 });
    }

    const { id } = await context.params;
    const result = await sendMessage(actor.user.userId, id, parsed.data.body);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
          ...(result.nudge ? { nudge: result.nudge } : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      message: {
        id: result.message.id,
        kind: result.message.kind,
        body: result.message.body,
        createdAt: result.message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Conversations] send message failed:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
