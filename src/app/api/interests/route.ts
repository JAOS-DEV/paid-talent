import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, profileInterests, workerProfiles, users } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createInterestSchema = z.object({
  workerProfileId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Only recruiters can express interest" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createInterestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { workerProfileId, message } = validation.data;

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, workerProfileId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    const [existingInterest] = await db
      .select()
      .from(profileInterests)
      .where(
        and(
          eq(profileInterests.recruiterUserId, session.user.id),
          eq(profileInterests.workerProfileId, workerProfileId)
        )
      )
      .limit(1);

    if (existingInterest) {
      return NextResponse.json(
        { error: "Interest already expressed" },
        { status: 409 }
      );
    }

    const [newInterest] = await db
      .insert(profileInterests)
      .values({
        recruiterUserId: session.user.id,
        workerProfileId,
        message: message || null,
        createdAt: new Date(),
      })
      .returning();

    console.log(
      `[Interest] Recruiter ${session.user.id} expressed interest in profile ${workerProfileId}`
    );

    return NextResponse.json({
      success: true,
      interest: {
        id: newInterest.id,
        workerProfileId: newInterest.workerProfileId,
        createdAt: newInterest.createdAt,
      },
    });
  } catch (error) {
    console.error("[Interest] Error creating interest:", error);
    return NextResponse.json(
      { error: "Failed to create interest" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "recruiter") {
      const interests = await db
        .select({
          id: profileInterests.id,
          workerProfileId: profileInterests.workerProfileId,
          workerName: workerProfiles.displayName,
          workerPhoto: workerProfiles.photoUrl,
          message: profileInterests.message,
          createdAt: profileInterests.createdAt,
        })
        .from(profileInterests)
        .innerJoin(
          workerProfiles,
          eq(profileInterests.workerProfileId, workerProfiles.id)
        )
        .where(eq(profileInterests.recruiterUserId, session.user.id))
        .orderBy(profileInterests.createdAt);

      return NextResponse.json({ interests });
    }

    if (session.user.role === "worker") {
      const [profile] = await db
        .select()
        .from(workerProfiles)
        .where(eq(workerProfiles.userId, session.user.id))
        .limit(1);

      if (!profile) {
        return NextResponse.json({ interests: [] });
      }

      const interests = await db
        .select({
          id: profileInterests.id,
          recruiterName: users.name,
          message: profileInterests.message,
          notifiedAt: profileInterests.notifiedAt,
          createdAt: profileInterests.createdAt,
        })
        .from(profileInterests)
        .innerJoin(users, eq(profileInterests.recruiterUserId, users.id))
        .where(eq(profileInterests.workerProfileId, profile.id))
        .orderBy(profileInterests.createdAt);

      return NextResponse.json({ interests });
    }

    return NextResponse.json({ interests: [] });
  } catch (error) {
    console.error("[Interest] Error fetching interests:", error);
    return NextResponse.json(
      { error: "Failed to fetch interests" },
      { status: 500 }
    );
  }
}
