import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { shareContact } from "@/lib/conversations";

const bodySchema = z.object({
  channel: z.enum(["line", "phone", "whatsapp"]),
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
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const { id } = await context.params;
    const result = await shareContact(
      actor.user.userId,
      id,
      parsed.data.channel
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
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
    console.error("[Conversations] share failed:", error);
    return NextResponse.json({ error: "Failed to share contact" }, { status: 500 });
  }
}
