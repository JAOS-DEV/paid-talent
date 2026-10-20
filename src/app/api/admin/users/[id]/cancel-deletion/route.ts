import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { cancelAccountDeletionRequest } from "@/lib/account/deletion";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const { id } = await params;
    const result = await cancelAccountDeletionRequest({
      targetUserId: id,
      actorUserId: guard.actor.userId,
      actorEmail: guard.actor.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Admin] cancel deletion failed:", error);
    return NextResponse.json(
      { error: "Could not cancel account deletion." },
      { status: 500 }
    );
  }
}
