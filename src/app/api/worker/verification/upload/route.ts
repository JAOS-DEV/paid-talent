import { NextRequest, NextResponse } from "next/server";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import {
  generatePresignedIdUploadUrl,
  generatePresignedLivenessVideoUploadUrl,
  ALLOWED_ID_DOCUMENT_TYPES,
  ALLOWED_LIVENESS_VIDEO_TYPES,
} from "@/lib/storage/s3";
import { canUploadLivenessVideo } from "@/lib/verification/challenge-lifecycle";
import { assertOwnedPrivateVerificationKey } from "@/lib/storage/keys";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

const uploadRequestSchema = z.object({
  type: z.enum(["id_document", "liveness_video"]),
  contentType: z.string(),
  idDocumentKey: z.string().min(1).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const [profile] = await db
      .select({
        id: workerProfiles.id,
        challengeCode: workerProfiles.challengeCode,
        challengeIssuedAt: workerProfiles.challengeIssuedAt,
        idDocumentKey: workerProfiles.idDocumentKey,
      })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
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
        actor.user.userId,
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
        try {
          assertOwnedPrivateVerificationKey(
            actor.user.userId,
            idDocumentKey,
            "id"
          );
        } catch {
          return NextResponse.json(
            { error: "Invalid verification upload" },
            { status: 400 }
          );
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
        actor.user.userId,
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
    console.error("[Worker Verification Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
