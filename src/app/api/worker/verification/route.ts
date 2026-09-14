import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles, verificationEvents } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  canTransitionVerificationStatus,
  computeFileSha256,
  toWorkerVerificationStatusDto,
  validateVerificationSubmission,
} from "@/lib/verification";
import {
  getOwnedIdDocumentBuffer,
  getOwnedLivenessVideoBuffer,
} from "@/lib/storage/s3";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import { assertOwnedPrivateVerificationKey } from "@/lib/storage/keys";

const submitVerificationSchema = z.object({
  idDocumentKey: z.string().min(1, "ID document key is required"),
  livenessVideoKey: z.string().min(1, "Liveness video key is required"),
  docType: z.enum(["passport", "thai_id", "drivers_license", "other"]),
});

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
        verificationStatus: workerProfiles.verificationStatus,
        idDocumentSubmittedAt: workerProfiles.idDocumentSubmittedAt,
        verificationReviewedAt: workerProfiles.verificationReviewedAt,
        challengeCode: workerProfiles.challengeCode,
        challengeIssuedAt: workerProfiles.challengeIssuedAt,
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

    return NextResponse.json({
      success: true,
      verification: toWorkerVerificationStatusDto(profile),
    });
  } catch (error) {
    console.error("[Worker Verification GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "worker") {
      return NextResponse.json({ error: "Not a worker" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = submitVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { idDocumentKey, livenessVideoKey, docType } = parsed.data;

    try {
      assertOwnedPrivateVerificationKey(
        session.user.id,
        idDocumentKey,
        "id"
      );
      assertOwnedPrivateVerificationKey(
        session.user.id,
        livenessVideoKey,
        "liveness"
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid verification upload" },
        { status: 400 }
      );
    }

    const [existingProfile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, session.user.id))
      .limit(1);

    if (!existingProfile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    const submissionValidation = validateVerificationSubmission({
      idDocumentKey,
      livenessVideoKey,
      challengeCode: existingProfile.challengeCode,
      challengeIssuedAt: existingProfile.challengeIssuedAt,
    });

    if (!submissionValidation.isValid) {
      return NextResponse.json(
        {
          error: "Verification submission incomplete",
          details: submissionValidation.errors,
        },
        { status: 400 }
      );
    }

    const transitionCheck = canTransitionVerificationStatus(
      existingProfile.verificationStatus,
      "pending"
    );

    if (!transitionCheck.allowed) {
      return NextResponse.json(
        {
          error: "Cannot submit verification",
          reason: transitionCheck.reason,
          currentStatus: existingProfile.verificationStatus,
        },
        { status: 400 }
      );
    }

    let idDocumentSha256: string | null = null;
    let livenessVideoSha256: string | null = null;

    try {
      const docBuffer = await getOwnedIdDocumentBuffer(
        session.user.id,
        idDocumentKey
      );
      idDocumentSha256 = computeFileSha256(docBuffer);
    } catch (error) {
      if (error instanceof PrivateStorageConfigError) {
        return NextResponse.json(
          {
            error:
              "Verification upload is temporarily unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
      console.error(
        "[Worker Verification] Failed to compute ID document hash:",
        error
      );
      return NextResponse.json(
        { error: "Failed to process ID document. Please re-upload." },
        { status: 400 }
      );
    }

    try {
      const videoBuffer = await getOwnedLivenessVideoBuffer(
        session.user.id,
        livenessVideoKey
      );
      livenessVideoSha256 = computeFileSha256(videoBuffer);
    } catch (error) {
      if (error instanceof PrivateStorageConfigError) {
        return NextResponse.json(
          {
            error:
              "Verification upload is temporarily unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
      console.error(
        "[Worker Verification] Failed to compute liveness video hash:",
        error
      );
      return NextResponse.json(
        { error: "Failed to process liveness video. Please re-upload." },
        { status: 400 }
      );
    }

    const now = new Date();

    await db.insert(verificationEvents).values({
      userId: session.user.id,
      workerProfileId: existingProfile.id,
      decision: "pending_submitted",
      actorUserId: session.user.id,
      actorType: "worker",
      method: "system",
      docType,
      idDocumentKey,
      idDocumentSha256,
      livenessVideoKey,
      livenessVideoSha256,
      challengeCode: existingProfile.challengeCode,
      createdAt: now,
    });

    const [updatedProfile] = await db
      .update(workerProfiles)
      .set({
        verificationStatus: "pending",
        idDocumentKey,
        livenessVideoKey,
        idDocumentSubmittedAt: now,
        updatedAt: now,
      })
      .where(eq(workerProfiles.userId, session.user.id))
      .returning();

    return NextResponse.json({
      success: true,
      verification: {
        verificationStatus: updatedProfile.verificationStatus,
        idDocumentSubmittedAt: updatedProfile.idDocumentSubmittedAt,
        hasIdDocument: true,
        hasLivenessVideo: true,
      },
      eventLogged: true,
    });
  } catch (error) {
    console.error("[Worker Verification POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit verification" },
      { status: 500 }
    );
  }
}
