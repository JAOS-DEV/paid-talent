import { NextResponse } from "next/server";
import { getRecruiterOutcomeStats } from "@/lib/hire-outcomes/queries";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const stats = await getRecruiterOutcomeStats(actor.user.userId);

    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
