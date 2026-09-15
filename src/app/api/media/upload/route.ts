import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  generatePresignedProfilePhotoStagingUrl,
  assertUploadedStagedProfileImageWithinLimit,
} from "@/lib/storage/s3";
import {
  sendModerationWebhook,
  canUploadPhoto,
  submitPhotoForModeration,
  PHOTO_POLICY_COPY,
} from "@/lib/moderation";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PROFILE_PHOTO_ERRORS, PROFILE_PHOTO_MAX_BYTES } from "@/lib/media/profile-photo";
import { publicMediaUploadRequestSchema } from "@/lib/media/public-upload-request";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import { assertOwnedPhotoStagingKey } from "@/lib/storage/keys";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

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

function privateStorageConfigResponse(stage: "presign" | "confirm"): NextResponse {
  logMediaEvent({ stage, status: 503 });
  console.error(
    "[Media Upload] Private photo staging is not configured. Set distinct S3_PRIVATE_* credentials for paid-talent-private."
  );
  return NextResponse.json(
    {
      error: PROFILE_PHOTO_ERRORS.serviceUnavailable,
      message: PROFILE_PHOTO_ERRORS.serviceUnavailable,
    },
    { status: 503 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    if (!actor.user.ageVerified) {
      return NextResponse.json(
        { error: "Age verification required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = publicMediaUploadRequestSchema.safeParse(body);

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

    const { contentType, contentLength, purpose } = validation.data;

    const [profile] = await db
      .select({ id: workerProfiles.id })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (profile) {
      const limitCheck = await canUploadPhoto(profile.id, purpose ?? "primary");
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

    const { uploadUrl, key } = await generatePresignedProfilePhotoStagingUrl(
      actor.user.userId,
      contentType,
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
      expiresIn: 3600,
      maxFileSize: PROFILE_PHOTO_MAX_BYTES,
      policy: {
        helper: PHOTO_POLICY_COPY.helper,
        rules: PHOTO_POLICY_COPY.rules,
      },
    });
  } catch (error) {
    if (error instanceof PrivateStorageConfigError) {
      return privateStorageConfigResponse("presign");
    }
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
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    const { key, purpose: rawPurpose } = body as {
      key?: unknown;
      purpose?: unknown;
    };

    if (typeof key !== "string" || !key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const purpose =
      rawPurpose === "gallery" || rawPurpose === "primary"
        ? rawPurpose
        : "primary";

    try {
      assertOwnedPhotoStagingKey(actor.user.userId, key);
    } catch {
      logMediaEvent({ stage: "confirm", status: 400 });
      return NextResponse.json(
        {
          error: PROFILE_PHOTO_ERRORS.uploadFailed,
          message: PROFILE_PHOTO_ERRORS.uploadFailed,
        },
        { status: 400 }
      );
    }

    try {
      await assertUploadedStagedProfileImageWithinLimit(key);
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
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    const uploadResult = await submitPhotoForModeration(
      actor.user.userId,
      profile.id,
      key,
      { purpose }
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
      userId: actor.user.userId,
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
      stagingKey: key,
      photoKey: uploadResult.photoKey ?? null,
      url: uploadResult.photoUrl ?? null,
      photoId: uploadResult.photoId,
      moderation: {
        status: uploadResult.status,
        message: uploadResult.userMessage,
        requiresReview: uploadResult.decision?.requiresReview ?? false,
      },
    });
  } catch (error) {
    if (error instanceof PrivateStorageConfigError) {
      return privateStorageConfigResponse("confirm");
    }
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
