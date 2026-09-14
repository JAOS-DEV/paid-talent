import { NextRequest, NextResponse } from "next/server";
import { getRecruiterInterestsWithOutcomes } from "@/lib/hire-outcomes/queries";
import type { HireOutcomeFilter } from "@/lib/hire-outcomes";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
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
      actor.user.userId,
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
