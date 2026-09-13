import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  generateChallengeCode,
  formatChallengeCodeForDisplay,
  CHALLENGE_CODE_EXPIRY_MINUTES,
} from "@/lib/verification";

export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "worker") {
      return NextResponse.json({ error: "Not a worker" }, { status: 403 });
    }

    const [profile] = await db
      .select({
        id: workerProfiles.id,
        verificationStatus: workerProfiles.verificationStatus,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, session.user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    if (
      profile.verificationStatus !== "unverified" &&
      profile.verificationStatus !== "rejected"
    ) {
      return NextResponse.json(
        {
          error: "Cannot generate challenge code",
          reason: `Profile is in ${profile.verificationStatus} status`,
        },
        { status: 400 }
      );
    }

    const challengeCode = generateChallengeCode();
    const now = new Date();

    await db
      .update(workerProfiles)
      .set({
        challengeCode,
        challengeIssuedAt: now,
        updatedAt: now,
      })
      .where(eq(workerProfiles.userId, session.user.id));

    const expiresAt = new Date(now);
    expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_CODE_EXPIRY_MINUTES);

    return NextResponse.json({
      success: true,
      challenge: {
        code: challengeCode,
        displayCode: formatChallengeCodeForDisplay(challengeCode),
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: CHALLENGE_CODE_EXPIRY_MINUTES,
        instructions:
          "Record a video holding your ID document next to your face. Clearly speak today's date and the challenge code shown above.",
      },
    });
  } catch (error) {
    console.error("[Worker Challenge Code] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate challenge code" },
      { status: 500 }
    );
  }
}

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
      .select({
        challengeCode: workerProfiles.challengeCode,
        challengeIssuedAt: workerProfiles.challengeIssuedAt,
        verificationStatus: workerProfiles.verificationStatus,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, session.user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    if (!profile.challengeCode || !profile.challengeIssuedAt) {
      return NextResponse.json({
        success: true,
        challenge: null,
        message: "No active challenge code. Request a new one with POST.",
      });
    }

    const expiresAt = new Date(profile.challengeIssuedAt);
    expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_CODE_EXPIRY_MINUTES);
    const isExpired = new Date() > expiresAt;

    return NextResponse.json({
      success: true,
      challenge: {
        code: profile.challengeCode,
        displayCode: formatChallengeCodeForDisplay(profile.challengeCode),
        issuedAt: profile.challengeIssuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isExpired,
        instructions:
          "Record a video holding your ID document next to your face. Clearly speak today's date and the challenge code shown above.",
      },
    });
  } catch (error) {
    console.error("[Worker Challenge Code GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenge code" },
      { status: 500 }
    );
  }
}
