import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generatePresignedUploadUrl, ALLOWED_IMAGE_TYPES } from "@/lib/storage/s3";
import { moderateProfilePhoto, sendModerationWebhook } from "@/lib/moderation";
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
    const { key, publicUrl } = body;

    if (!key || !publicUrl) {
      return NextResponse.json(
        { error: "Missing key or publicUrl" },
        { status: 400 }
      );
    }

    const moderationResult = await moderateProfilePhoto(
      publicUrl,
      session.user.id
    );

    await sendModerationWebhook({
      type: "image",
      resourceId: key,
      resourceType: "profile_photo",
      userId: session.user.id,
      result: moderationResult,
      timestamp: new Date(),
    });

    if (!moderationResult.approved) {
      return NextResponse.json(
        {
          error: "Image did not pass moderation",
          reason: moderationResult.reason,
        },
        { status: 400 }
      );
    }

    if (session.user.role === "worker") {
      await db
        .update(workerProfiles)
        .set({
          photoKey: key,
          photoUrl: publicUrl,
          updatedAt: new Date(),
        })
        .where(eq(workerProfiles.userId, session.user.id));
    }

    return NextResponse.json({
      success: true,
      key,
      url: publicUrl,
      moderation: {
        approved: moderationResult.approved,
        flagged: moderationResult.flagged,
      },
    });
  } catch (error) {
    console.error("[Media Confirm] Error:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
