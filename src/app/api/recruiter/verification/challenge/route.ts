import { NextRequest, NextResponse } from "next/server";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { recruiterVerificationSubject } from "@/lib/verification/subject";
import {
  getActiveChallenge,
  issueChallenge,
} from "@/lib/verification/service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "ID document must be uploaded before video verification" },
        { status: 400 }
      );
    }

    return await issueChallenge(
      recruiterVerificationSubject,
      actor.user.userId,
      body
    );
  } catch (error) {
    console.error("[Recruiter Challenge Code] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate challenge code" },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    return await getActiveChallenge(
      recruiterVerificationSubject,
      actor.user.userId
    );
  } catch (error) {
    console.error("[Recruiter Challenge Code GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenge code" },
      { status: 500 }
    );
  }
}
