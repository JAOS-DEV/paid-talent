import { NextRequest, NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { recruiterVerificationSubject } from "@/lib/verification/subject";
import {
  getVerificationStatus,
  submitVerification,
} from "@/lib/verification/service";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    return await getVerificationStatus(
      recruiterVerificationSubject,
      actor.user.userId
    );
  } catch (error) {
    console.error("[Recruiter Verification GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    return await submitVerification(
      recruiterVerificationSubject,
      actor.user.userId,
      body
    );
  } catch (error) {
    console.error("[Recruiter Verification POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit verification" },
      { status: 500 }
    );
  }
}
