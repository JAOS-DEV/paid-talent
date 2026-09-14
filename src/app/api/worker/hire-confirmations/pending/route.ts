import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPendingConfirmationRequestsForWorker } from "@/lib/hire-outcomes/queries";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "worker") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const requests = await getPendingConfirmationRequestsForWorker(
      session.user.id
    );

    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
