import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  generatePresignedUploadUrl,
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

const uploadRequestSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]]),
  folder: z.enum(["profiles", "documents"]).default("profiles"),
});

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
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { contentType, folder } = validation.data;

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
      folder
    );

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl,
      expiresIn: 3600,
      policy: {
        helper: PHOTO_POLICY_COPY.helper,
        rules: PHOTO_POLICY_COPY.rules,
      },
    });
  } catch (error) {
    console.error("[Media Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
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

    return NextResponse.json({
      success: true,
      key,
      url: publicUrl,
    });
  } catch (error) {
    console.error("[Media Confirm] Error:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
