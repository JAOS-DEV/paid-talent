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

const createBodySchema = z
  .object({
    conversationId: z.string().uuid().optional().nullable(),
    contactRequestId: z.string().uuid().optional().nullable(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.conversationId || data.contactRequestId),
    { message: "conversationId or contactRequestId is required" }
  );

const deleteBodySchema = z
  .object({
    blockId: z.string().uuid(),
  })
  .strict();

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
    const parsed = createBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid block payload" }, { status: 400 });
    }

    const result = await blockUser({
      blockerUserId: actor.user.userId,
      conversationId: parsed.data.conversationId,
      contactRequestId: parsed.data.contactRequestId,
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
    const parsed = deleteBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid unblock payload" }, { status: 400 });
    }

    const result = await unblockUser({
      blockerUserId: actor.user.userId,
      blockId: parsed.data.blockId,
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
