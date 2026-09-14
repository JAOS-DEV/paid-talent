import { NextResponse } from "next/server";
import { db, recruiterProfiles, recruiterOpenings } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

/**
 * Authenticated recruiter openings list for client UI (interest selector, etc.).
 * Returns only the current recruiter's openings (ownership via session).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const [profile] = await db
      .select({ id: recruiterProfiles.id })
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ openings: [] });
    }

    const openings = await db
      .select()
      .from(recruiterOpenings)
      .where(eq(recruiterOpenings.recruiterProfileId, profile.id))
      .orderBy(recruiterOpenings.createdAt);

    return NextResponse.json({ openings });
  } catch (error) {
    console.error("[Recruiter Openings] Error listing openings:", error);
    return NextResponse.json(
      { error: "Failed to list openings" },
      { status: 500 }
    );
  }
}
