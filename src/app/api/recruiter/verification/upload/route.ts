import { NextRequest, NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import { recruiterVerificationSubject } from "@/lib/verification/subject";
import { createUploadUrl } from "@/lib/verification/service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    return await createUploadUrl(
      recruiterVerificationSubject,
      actor.user.userId,
      body
    );
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
    console.error("[Recruiter Verification Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
