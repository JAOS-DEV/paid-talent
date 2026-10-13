import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { reviewMessageFlag } from "@/lib/admin/reports";

const bodySchema = z.object({
  status: z.enum(["dismissed", "actioned"]),
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
      return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
    }

    const result = await reviewMessageFlag({
      flagId: id,
      status: parsed.data.status,
      actorUserId: guard.actor.userId,
      actorEmail: guard.actor.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Admin flags] review failed:", error);
    return NextResponse.json({ error: "Failed to review flag" }, { status: 500 });
  }
}
