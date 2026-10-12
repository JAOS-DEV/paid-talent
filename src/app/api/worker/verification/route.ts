import { NextRequest, NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import { workerVerificationSubject } from "@/lib/verification/subject";
import {
  getVerificationStatus,
  submitVerification,
} from "@/lib/verification/service";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    return await getVerificationStatus(
      workerVerificationSubject,
      actor.user.userId
    );
  } catch (error) {
    console.error("[Worker Verification GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    return await submitVerification(
      workerVerificationSubject,
      actor.user.userId,
      body
    );
  } catch (error) {
    console.error("[Worker Verification POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit verification" },
      { status: 500 }
    );
  }
}
