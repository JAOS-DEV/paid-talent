import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  db,
  profileInterests,
  workerProfiles,
  users,
  recruiterProfiles,
  recruiterOpenings,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  createInterestSchema,
  sanitizeMessage,
} from "@/lib/helpers/interest-validation";
import { resolveOpeningAttachment } from "@/lib/interests/opening-attachment";

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

    const { workerProfileId, message, openingId } = validation.data;

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

    const [recruiterProfile] = await db
      .select({ id: recruiterProfiles.id })
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.userId, session.user.id))
      .limit(1);

    if (!recruiterProfile) {
      return NextResponse.json(
        { error: "Recruiter profile not found" },
        { status: 404 }
      );
    }

    let resolvedOpeningId: string | null = null;
    if (openingId) {
      const [opening] = await db
        .select({
          id: recruiterOpenings.id,
          recruiterProfileId: recruiterOpenings.recruiterProfileId,
          isPublished: recruiterOpenings.isPublished,
        })
        .from(recruiterOpenings)
        .where(eq(recruiterOpenings.id, openingId))
        .limit(1);

      const attachment = resolveOpeningAttachment({
        openingId,
        recruiterProfileId: recruiterProfile.id,
        opening: opening
          ? {
              id: opening.id,
              recruiterProfileId: opening.recruiterProfileId,
              isPublished: opening.isPublished,
            }
          : null,
      });

      if (!attachment.ok) {
        return NextResponse.json(
          { error: attachment.error },
          { status: attachment.status }
        );
      }

      resolvedOpeningId = attachment.openingId;
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
        openingId: resolvedOpeningId,
        message: sanitizeMessage(message),
        createdAt: new Date(),
      })
      .returning();

    console.log(
      `[Interest] Recruiter ${session.user.id} expressed interest in profile ${workerProfileId}`
    );

    return NextResponse.json({
      success: true,
      interestId: newInterest.id,
      interest: {
        id: newInterest.id,
        workerProfileId: newInterest.workerProfileId,
        openingId: newInterest.openingId,
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

export async function GET(_request: NextRequest): Promise<NextResponse> {
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
          openingId: profileInterests.openingId,
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
          openingId: profileInterests.openingId,
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
