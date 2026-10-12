import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import {
  getWorkerInboundPrefs,
  updateWorkerInboundPrefs,
} from "@/lib/contact-requests";

const putSchema = z.object({
  dailyLimit: z.number().int().min(1).max(100).optional(),
  paused: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const prefs = await getWorkerInboundPrefs(actor.user.userId);
    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[InboundSettings] get failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbound settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveWorker();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const body = await request.json();
    const validation = putSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const prefs = await updateWorkerInboundPrefs({
      userId: actor.user.userId,
      dailyLimit: validation.data.dailyLimit,
      paused: validation.data.paused,
    });

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[InboundSettings] put failed:", error);
    return NextResponse.json(
      { error: "Failed to update inbound settings" },
      { status: 500 }
    );
  }
}
