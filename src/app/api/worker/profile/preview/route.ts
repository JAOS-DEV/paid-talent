import { NextResponse } from "next/server";
import { getOwnWorkerPreview } from "@/lib/worker-profile/preview";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const profile = await getOwnWorkerPreview(actor.user.userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[Worker Preview] Error:", error);
    return NextResponse.json(
      { error: "Failed to load profile preview" },
      { status: 500 }
    );
  }
}
