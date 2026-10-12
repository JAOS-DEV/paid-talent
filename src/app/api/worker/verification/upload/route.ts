import { NextRequest, NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import { workerVerificationSubject } from "@/lib/verification/subject";
import { createUploadUrl } from "@/lib/verification/service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    return await createUploadUrl(
      workerVerificationSubject,
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
    console.error("[Worker Verification Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
