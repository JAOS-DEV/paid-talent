import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { setRecruiterMessagingPaused } from "@/lib/safety/messaging-pause";

const bodySchema = z.object({
  paused: z.boolean(),
  reason: z.string().min(3).max(1000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A reason of at least 3 characters is required." },
        { status: 400 }
      );
    }

    const result = await setRecruiterMessagingPaused({
      recruiterUserId: id,
      paused: parsed.data.paused,
      reason: parsed.data.reason,
      actorUserId: guard.actor.userId,
      actorEmail: guard.actor.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, isPaused: result.isPaused });
  } catch (error) {
    console.error("[Admin messaging-pause] failed:", error);
    return NextResponse.json(
      { error: "Failed to update messaging pause" },
      { status: 500 }
    );
  }
}
