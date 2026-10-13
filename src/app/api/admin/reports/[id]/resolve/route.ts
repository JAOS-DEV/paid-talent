import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { resolveReport } from "@/lib/admin/reports";

const bodySchema = z.object({
  status: z.enum(["actioned", "dismissed", "reviewing"]),
  note: z.string().max(2000).optional().nullable(),
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
      return NextResponse.json({ error: "Invalid resolve payload" }, { status: 400 });
    }

    const result = await resolveReport({
      reportId: id,
      status: parsed.data.status,
      note: parsed.data.note,
      actorUserId: guard.actor.userId,
      actorEmail: guard.actor.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Admin reports] resolve failed:", error);
    return NextResponse.json({ error: "Failed to resolve report" }, { status: 500 });
  }
}
