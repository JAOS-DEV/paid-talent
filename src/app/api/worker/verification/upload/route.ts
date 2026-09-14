import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

const uploadRequestSchema = z.object({
  type: z.enum(["id_document", "liveness_video"]),
  contentType: z.string(),
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

    const [profile] = await db
      .select({
        id: workerProfiles.id,
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

    const { type, contentType } = parsed.data;

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
        session.user.id,
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
      if (!profile.challengeCode || !profile.challengeIssuedAt) {
        return NextResponse.json(
          {
            error:
              "Must generate a challenge code before uploading liveness video",
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
        session.user.id,
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
        { error: "Verification upload is temporarily unavailable. Please try again later." },
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
