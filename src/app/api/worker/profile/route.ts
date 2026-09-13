import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "worker") {
      return NextResponse.json({ error: "Not a worker" }, { status: 403 });
    }

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, session.user.id))
      .limit(1);

    return NextResponse.json({ profile: profile || null });
  } catch (error) {
    console.error("[Worker Profile] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
