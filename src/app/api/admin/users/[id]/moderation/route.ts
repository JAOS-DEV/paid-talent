import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { moderateAccount } from "@/lib/admin/account-moderation";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

const bodySchema = z.object({
  action: z.enum(["suspend", "reactivate", "ban", "lift_ban"]),
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
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A reason of at least 3 characters is required." },
        { status: 400 }
      );
    }

    const result = await moderateAccount({
      action: parsed.data.action,
      targetUserId: id,
      reason: parsed.data.reason,
      actorUserId: guard.actor.userId,
      actorEmail: guard.actor.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      accountStatus: result.accountStatus,
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin user moderation]", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
