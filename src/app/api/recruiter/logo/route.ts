import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { PublicMediaConfigError } from "@/lib/media/public-url";
import { publicMediaUploadRequestSchema } from "@/lib/media/public-upload-request";
import { PROFILE_PHOTO_ERRORS } from "@/lib/media/profile-photo";
import {
  clearVenueLogo,
  confirmVenueLogo,
  presignVenueLogo,
} from "@/lib/media/venue-logo-service";
import { VENUE_LOGO_ERRORS } from "@/lib/media/venue-logo";
import { PrivateStorageConfigError } from "@/lib/storage/config";

function storageConfigResponse(): NextResponse {
  return NextResponse.json(
    {
      error: VENUE_LOGO_ERRORS.serviceUnavailable,
      message: VENUE_LOGO_ERRORS.serviceUnavailable,
    },
    { status: 503 }
  );
}

function isStorageConfigError(error: unknown): boolean {
  return (
    error instanceof PrivateStorageConfigError ||
    error instanceof PublicMediaConfigError
  );
}

function revalidateVenueSurfaces(): void {
  revalidatePath("/recruiter/profile");
  revalidatePath("/recruiter/openings");
  revalidatePath("/recruiter/dashboard");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
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
      return NextResponse.json({ error: message, message }, { status: 400 });
    }

    const result = await presignVenueLogo(
      actor.user.userId,
      validation.data.contentType,
      validation.data.contentLength
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      key: result.key,
      expiresIn: 3600,
    });
  } catch (error) {
    if (isStorageConfigError(error)) {
      return storageConfigResponse();
    }
    console.error("[Venue Logo] Presign error:", error);
    return NextResponse.json(
      {
        error: VENUE_LOGO_ERRORS.serviceUnavailable,
        message: VENUE_LOGO_ERRORS.serviceUnavailable,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = (await request.json()) as { key?: unknown };
    if (typeof body.key !== "string" || !body.key) {
      return NextResponse.json(
        { error: "Missing key", message: "Missing key" },
        { status: 400 }
      );
    }

    const result = await confirmVenueLogo(actor.user.userId, body.key);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, message: result.message },
        { status: result.status }
      );
    }

    revalidateVenueSurfaces();
    return NextResponse.json({
      success: true,
      logoKey: result.logoKey,
      logoUrl: result.logoUrl,
    });
  } catch (error) {
    if (isStorageConfigError(error)) {
      return storageConfigResponse();
    }
    console.error("[Venue Logo] Confirm error:", error);
    return NextResponse.json(
      {
        error: VENUE_LOGO_ERRORS.uploadFailed,
        message: VENUE_LOGO_ERRORS.uploadFailed,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const result = await clearVenueLogo(actor.user.userId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, message: result.message },
        { status: result.status }
      );
    }

    revalidateVenueSurfaces();
    return NextResponse.json({ success: true, logoKey: null, logoUrl: null });
  } catch (error) {
    if (isStorageConfigError(error)) {
      return storageConfigResponse();
    }
    console.error("[Venue Logo] Clear error:", error);
    return NextResponse.json(
      {
        error: VENUE_LOGO_ERRORS.uploadFailed,
        message: VENUE_LOGO_ERRORS.uploadFailed,
      },
      { status: 500 }
    );
  }
}
