import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, recruiterProfiles, recruiterOpenings } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Authenticated recruiter openings list for client UI (interest selector, etc.).
 * Returns only the current recruiter's openings (ownership via session).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "recruiter") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db
      .select({ id: recruiterProfiles.id })
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.userId, session.user.id))
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
