import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import {
  blockUser,
  listBlockedAccounts,
  unblockUser,
} from "@/lib/safety/blocks";

const bodySchema = z.object({
  userId: z.string().uuid(),
  conversationId: z.string().uuid().optional().nullable(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const blocks = await listBlockedAccounts(actor.user.userId);
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[Blocks] list failed:", error);
    return NextResponse.json({ error: "Failed to list blocks" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid block payload" }, { status: 400 });
    }

    const result = await blockUser({
      blockerUserId: actor.user.userId,
      blockedUserId: parsed.data.userId,
      conversationId: parsed.data.conversationId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, blockId: result.block.id });
  } catch (error) {
    console.error("[Blocks] create failed:", error);
    return NextResponse.json({ error: "Failed to block user" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid unblock payload" }, { status: 400 });
    }

    const result = await unblockUser({
      blockerUserId: actor.user.userId,
      blockedUserId: parsed.data.userId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Blocks] delete failed:", error);
    return NextResponse.json({ error: "Failed to unblock user" }, { status: 500 });
  }
}
