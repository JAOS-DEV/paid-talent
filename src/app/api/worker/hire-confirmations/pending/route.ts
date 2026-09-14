import { NextResponse } from "next/server";
import { getPendingConfirmationRequestsForWorker } from "@/lib/hire-outcomes/queries";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const requests = await getPendingConfirmationRequestsForWorker(
      actor.user.userId
    );

    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
