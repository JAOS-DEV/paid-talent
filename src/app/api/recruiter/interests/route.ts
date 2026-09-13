import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecruiterInterestsWithOutcomes } from "@/lib/hire-outcomes/queries";
import type { HireOutcomeFilter } from "@/lib/hire-outcomes";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const filterParam = searchParams.get("filter");

    let filter: HireOutcomeFilter = "any";
    if (
      filterParam === "interested" ||
      filterParam === "hired" ||
      filterParam === "started"
    ) {
      filter = filterParam;
    }

    const interests = await getRecruiterInterestsWithOutcomes(
      session.user.id,
      filter
    );

    return NextResponse.json({ interests });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
