import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  generateChallengeCode,
  formatChallengeCodeForDisplay,
  CHALLENGE_CODE_EXPIRY_MINUTES,
} from "@/lib/verification";
import { canIssueChallengeCode } from "@/lib/verification/challenge-lifecycle";
import { assertOwnedPrivateVerificationKey } from "@/lib/storage/keys";

const issueChallengeSchema = z.object({
  idDocumentKey: z.string().min(1, "ID document key is required"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "worker") {
      return NextResponse.json({ error: "Not a worker" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "ID document must be uploaded before video verification" },
        { status: 400 }
      );
    }

    const parsed = issueChallengeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "ID document must be uploaded before video verification",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { idDocumentKey } = parsed.data;

    try {
      assertOwnedPrivateVerificationKey(session.user.id, idDocumentKey, "id");
    } catch {
      return NextResponse.json(
        { error: "Invalid verification upload" },
        { status: 400 }
      );
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

    const issueGuard = canIssueChallengeCode(profile.verificationStatus);
    if (!issueGuard.allowed) {
      return NextResponse.json(
        {
          error: "Cannot generate challenge code",
          reason: issueGuard.reason,
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
        idDocumentKey,
        updatedAt: now,
      })
      .where(eq(workerProfiles.userId, session.user.id));

    const expiresAt = new Date(now);
    expiresAt.setMinutes(
      expiresAt.getMinutes() + CHALLENGE_CODE_EXPIRY_MINUTES
    );

    return NextResponse.json({
      success: true,
      challenge: {
        code: challengeCode,
        displayCode: formatChallengeCodeForDisplay(challengeCode),
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: CHALLENGE_CODE_EXPIRY_MINUTES,
        instructions:
          "Hold your ID beside your face and clearly speak the challenge code shown on screen.",
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
    expiresAt.setMinutes(
      expiresAt.getMinutes() + CHALLENGE_CODE_EXPIRY_MINUTES
    );
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
          "Hold your ID beside your face and clearly speak the challenge code shown on screen.",
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
