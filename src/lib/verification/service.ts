import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, verificationEvents } from "@/lib/db";
import {
  canTransitionVerificationStatus,
  computeFileSha256,
  formatChallengeCodeForDisplay,
  generateChallengeCode,
  toWorkerVerificationStatusDto,
  validateVerificationSubmission,
  CHALLENGE_CODE_EXPIRY_MINUTES,
} from "@/lib/verification";
import { canIssueChallengeCode, canUploadLivenessVideo } from "@/lib/verification/challenge-lifecycle";
import type { VerificationSubjectAdapter } from "@/lib/verification/subject";
import { assertOwnedPrivateVerificationKey } from "@/lib/storage/keys";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import {
  ALLOWED_ID_DOCUMENT_TYPES,
  ALLOWED_LIVENESS_VIDEO_TYPES,
  generatePresignedIdUploadUrl,
  generatePresignedLivenessVideoUploadUrl,
  getOwnedIdDocumentBuffer,
  getOwnedLivenessVideoBuffer,
} from "@/lib/storage/s3";

export const submitVerificationSchema = z.object({
  idDocumentKey: z.string().min(1, "ID document key is required"),
  livenessVideoKey: z.string().min(1, "Liveness video key is required"),
  docType: z.enum(["passport", "thai_id", "drivers_license", "other"]),
});

export const issueChallengeSchema = z.object({
  idDocumentKey: z.string().min(1, "ID document key is required"),
});

export const uploadRequestSchema = z.object({
  type: z.enum(["id_document", "liveness_video"]),
  contentType: z.string(),
  idDocumentKey: z.string().min(1).optional(),
});

const CHALLENGE_INSTRUCTIONS =
  "Hold your ID beside your face and clearly speak the challenge code shown on screen.";

function ownershipErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: "Invalid verification upload" },
    { status: 400 }
  );
}

function assertOwnedKeys(
  userId: string,
  keys: Array<{ key: string; kind: "id" | "liveness" }>
): NextResponse | null {
  try {
    for (const { key, kind } of keys) {
      assertOwnedPrivateVerificationKey(userId, key, kind);
    }
    return null;
  } catch {
    return ownershipErrorResponse();
  }
}

async function latestRejectionNote(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ notes: verificationEvents.notes })
    .from(verificationEvents)
    .where(
      and(
        eq(verificationEvents.userId, userId),
        eq(verificationEvents.decision, "rejected")
      )
    )
    .orderBy(desc(verificationEvents.createdAt))
    .limit(1);
  const note = row?.notes?.trim();
  return note ? note : null;
}

export async function getVerificationStatus(
  subject: VerificationSubjectAdapter,
  userId: string
): Promise<NextResponse> {
  const profile = await subject.loadByUserId(userId);

  if (!profile) {
    return NextResponse.json(
      { error: subject.profileNotFoundError },
      { status: 404 }
    );
  }

  const rejectionNote =
    profile.verificationStatus === "rejected"
      ? await latestRejectionNote(userId)
      : null;

  return NextResponse.json({
    success: true,
    verification: {
      ...toWorkerVerificationStatusDto(profile),
      rejectionNote,
    },
  });
}

export async function submitVerification(
  subject: VerificationSubjectAdapter,
  userId: string,
  body: unknown
): Promise<NextResponse> {
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

  const ownershipError = assertOwnedKeys(userId, [
    { key: idDocumentKey, kind: "id" },
    { key: livenessVideoKey, kind: "liveness" },
  ]);
  if (ownershipError) {
    return ownershipError;
  }

  const existingProfile = await subject.loadByUserId(userId);

  if (!existingProfile) {
    return NextResponse.json(
      { error: subject.profileNotFoundError },
      { status: 404 }
    );
  }

  const submissionValidation = validateVerificationSubmission({
    idDocumentKey,
    livenessVideoKey,
    challengeCode: existingProfile.challengeCode,
    challengeIssuedAt: existingProfile.challengeIssuedAt,
    boundIdDocumentKey: existingProfile.idDocumentKey,
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
    const docBuffer = await getOwnedIdDocumentBuffer(userId, idDocumentKey);
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
      `[${subject.type} Verification] Failed to compute ID document hash:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to process ID document. Please re-upload." },
      { status: 400 }
    );
  }

  try {
    const videoBuffer = await getOwnedLivenessVideoBuffer(
      userId,
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
      `[${subject.type} Verification] Failed to compute liveness video hash:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to process liveness video. Please re-upload." },
      { status: 400 }
    );
  }

  const now = new Date();

  await db.insert(verificationEvents).values({
    userId,
    ...subject.eventFk(existingProfile.id),
    decision: "pending_submitted",
    actorUserId: userId,
    actorType: subject.actorType,
    method: "system",
    docType,
    idDocumentKey,
    idDocumentSha256,
    livenessVideoKey,
    livenessVideoSha256,
    challengeCode: existingProfile.challengeCode,
    createdAt: now,
  });

  const updatedProfile = await subject.update(existingProfile.id, {
    verificationStatus: "pending",
    idDocumentKey,
    livenessVideoKey,
    idDocumentSubmittedAt: now,
    updatedAt: now,
  });

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
}

export async function issueChallenge(
  subject: VerificationSubjectAdapter,
  userId: string,
  body: unknown
): Promise<NextResponse> {
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

  const ownershipError = assertOwnedKeys(userId, [
    { key: idDocumentKey, kind: "id" },
  ]);
  if (ownershipError) {
    return ownershipError;
  }

  const profile =
    subject.type === "recruiter"
      ? await subject.ensureByUserId(userId)
      : await subject.loadByUserId(userId);

  if (!profile) {
    return NextResponse.json(
      { error: subject.profileNotFoundError },
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

  await subject.update(profile.id, {
    challengeCode,
    challengeIssuedAt: now,
    idDocumentKey,
    updatedAt: now,
  });

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
      instructions: CHALLENGE_INSTRUCTIONS,
    },
  });
}

export async function getActiveChallenge(
  subject: VerificationSubjectAdapter,
  userId: string
): Promise<NextResponse> {
  const profile = await subject.loadByUserId(userId);

  if (!profile) {
    return NextResponse.json(
      { error: subject.profileNotFoundError },
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
      instructions: CHALLENGE_INSTRUCTIONS,
    },
  });
}

export async function createUploadUrl(
  subject: VerificationSubjectAdapter,
  userId: string,
  body: unknown
): Promise<NextResponse> {
  const profile =
    subject.type === "recruiter"
      ? await subject.ensureByUserId(userId)
      : await subject.loadByUserId(userId);

  if (!profile) {
    return NextResponse.json(
      { error: subject.profileNotFoundError },
      { status: 404 }
    );
  }

  const parsed = uploadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { type, contentType, idDocumentKey } = parsed.data;

  if (type === "id_document") {
    if (!ALLOWED_ID_DOCUMENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type for ID document. Allowed: ${ALLOWED_ID_DOCUMENT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { uploadUrl, key } = await generatePresignedIdUploadUrl(
      userId,
      contentType
    );

    return NextResponse.json({
      success: true,
      type: "id_document",
      uploadUrl,
      key,
      expiresIn: 3600,
    });
  }

  if (type === "liveness_video") {
    if (idDocumentKey) {
      const ownershipError = assertOwnedKeys(userId, [
        { key: idDocumentKey, kind: "id" },
      ]);
      if (ownershipError) {
        return ownershipError;
      }
    }

    const livenessGuard = canUploadLivenessVideo({
      challengeCode: profile.challengeCode,
      challengeIssuedAt: profile.challengeIssuedAt,
      boundIdDocumentKey: profile.idDocumentKey,
      requestedIdDocumentKey: idDocumentKey,
    });

    if (!livenessGuard.allowed) {
      return NextResponse.json(
        {
          error: livenessGuard.errors[0] || "Cannot upload liveness video",
          details: livenessGuard.errors,
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_LIVENESS_VIDEO_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type for liveness video. Allowed: ${ALLOWED_LIVENESS_VIDEO_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { uploadUrl, key } = await generatePresignedLivenessVideoUploadUrl(
      userId,
      contentType
    );

    return NextResponse.json({
      success: true,
      type: "liveness_video",
      uploadUrl,
      key,
      expiresIn: 3600,
    });
  }

  return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
}
