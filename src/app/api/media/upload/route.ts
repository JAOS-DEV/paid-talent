import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  generatePresignedUploadUrl,
  assertUploadedProfileImageWithinLimit,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/storage/s3";
import {
  sendModerationWebhook,
  canUploadPhoto,
  submitPhotoForModeration,
  PHOTO_POLICY_COPY,
} from "@/lib/moderation";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_MAX_BYTES,
} from "@/lib/media/profile-photo";

const uploadRequestSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]]),
  folder: z.enum(["profiles", "documents"]).default("profiles"),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_ERRORS.tooLarge),
});

function logMediaEvent(event: {
  stage: string;
  status: number;
  contentType?: string;
  contentLength?: number;
}): void {
  console.info("[media]", {
    stage: event.stage,
    status: event.status,
    contentType: event.contentType,
    fileSize: event.contentLength,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.ageVerified) {
      return NextResponse.json(
        { error: "Age verification required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = uploadRequestSchema.safeParse(body);

    if (!validation.success) {
      const sizeIssue = validation.error.issues.find(
        (issue) => issue.path[0] === "contentLength"
      );
      const message = sizeIssue
        ? PROFILE_PHOTO_ERRORS.tooLarge
        : "Invalid request";
      logMediaEvent({
        stage: "presign",
        status: 400,
        contentType:
          typeof body?.contentType === "string" ? body.contentType : undefined,
        contentLength:
          typeof body?.contentLength === "number" ? body.contentLength : undefined,
      });
      return NextResponse.json(
        {
          error: message,
          message,
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { contentType, folder, contentLength } = validation.data;

    if (folder === "profiles" && session.user.role === "worker") {
      const [profile] = await db
        .select({ id: workerProfiles.id })
        .from(workerProfiles)
        .where(eq(workerProfiles.userId, session.user.id))
        .limit(1);

      if (profile) {
        const limitCheck = await canUploadPhoto(profile.id);
        if (!limitCheck.canUpload) {
          return NextResponse.json(
            {
              error: "Upload limit reached",
              message: limitCheck.reason,
              limits: {
                approved: limitCheck.currentApprovedCount,
                pending: limitCheck.currentPendingCount,
              },
            },
            { status: 400 }
          );
        }
      }
    }

    const { uploadUrl, key, publicUrl } = await generatePresignedUploadUrl(
      session.user.id,
      contentType,
      folder,
      contentLength
    );

    logMediaEvent({
      stage: "presign",
      status: 200,
      contentType,
      contentLength,
    });

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl,
      expiresIn: 3600,
      maxFileSize: PROFILE_PHOTO_MAX_BYTES,
      policy: {
        helper: PHOTO_POLICY_COPY.helper,
        rules: PHOTO_POLICY_COPY.rules,
      },
    });
  } catch (error) {
    logMediaEvent({ stage: "presign", status: 500 });
    console.error("[Media Upload] Error:", error);
    return NextResponse.json(
      {
        error: PROFILE_PHOTO_ERRORS.serviceUnavailable,
        message: PROFILE_PHOTO_ERRORS.serviceUnavailable,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { key, publicUrl, folder } = body;

    if (!key || !publicUrl) {
      return NextResponse.json(
        { error: "Missing key or publicUrl" },
        { status: 400 }
      );
    }

    if (
      (folder === "profiles" || key.startsWith("profiles/")) &&
      session.user.role === "worker"
    ) {
      try {
        await assertUploadedProfileImageWithinLimit(key);
      } catch (error) {
        const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
        const message =
          code === "UPLOAD_TOO_LARGE"
            ? PROFILE_PHOTO_ERRORS.tooLarge
            : code === "UPLOAD_INVALID_TYPE"
              ? PROFILE_PHOTO_ERRORS.invalidType
              : PROFILE_PHOTO_ERRORS.uploadFailed;
        logMediaEvent({
          stage: "confirm",
          status: 400,
        });
        return NextResponse.json(
          { error: message, message },
          { status: 400 }
        );
      }

      const [profile] = await db
        .select({ id: workerProfiles.id })
        .from(workerProfiles)
        .where(eq(workerProfiles.userId, session.user.id))
        .limit(1);

      if (!profile) {
        return NextResponse.json(
          { error: "Worker profile not found" },
          { status: 404 }
        );
      }

      const uploadResult = await submitPhotoForModeration(
        session.user.id,
        profile.id,
        key,
        publicUrl
      );

      if (!uploadResult.success) {
        logMediaEvent({
          stage: "confirm",
          status: 400,
        });
        return NextResponse.json(
          {
            error: uploadResult.error,
            message: uploadResult.userMessage,
          },
          { status: 400 }
        );
      }

      await sendModerationWebhook({
        type: "image",
        resourceId: key,
        resourceType: "profile_photo",
        userId: session.user.id,
        result: {
          approved: uploadResult.status === "approved",
          flagged: uploadResult.status !== "approved",
          reason: uploadResult.decision?.reason,
        },
        timestamp: new Date(),
      });

      logMediaEvent({
        stage: "confirm",
        status: 200,
      });

      return NextResponse.json({
        success: true,
        key,
        url: publicUrl,
        photoId: uploadResult.photoId,
        moderation: {
          status: uploadResult.status,
          message: uploadResult.userMessage,
          requiresReview: uploadResult.decision?.requiresReview ?? false,
        },
      });
    }

    if (key.startsWith("profiles/")) {
      try {
        await assertUploadedProfileImageWithinLimit(key);
      } catch (error) {
        const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
        const message =
          code === "UPLOAD_TOO_LARGE"
            ? PROFILE_PHOTO_ERRORS.tooLarge
            : PROFILE_PHOTO_ERRORS.uploadFailed;
        return NextResponse.json({ error: message, message }, { status: 400 });
      }
    }

    logMediaEvent({
      stage: "confirm",
      status: 200,
    });

    return NextResponse.json({
      success: true,
      key,
      url: publicUrl,
    });
  } catch (error) {
    logMediaEvent({ stage: "confirm", status: 500 });
    console.error("[Media Confirm] Error:", error);
    return NextResponse.json(
      {
        error: PROFILE_PHOTO_ERRORS.uploadFailed,
        message: PROFILE_PHOTO_ERRORS.uploadFailed,
      },
      { status: 500 }
    );
  }
}
