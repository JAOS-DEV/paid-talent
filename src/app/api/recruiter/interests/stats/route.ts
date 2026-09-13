import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecruiterOutcomeStats } from "@/lib/hire-outcomes/queries";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const stats = await getRecruiterOutcomeStats(session.user.id);

    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
