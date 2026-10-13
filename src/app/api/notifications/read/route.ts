import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { markNotificationsRead } from "@/lib/notifications";

const bodySchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
    all: z.literal(true).optional(),
  })
  .refine((value) => value.all === true || (value.ids?.length ?? 0) > 0, {
    message: "Provide ids or all:true",
  });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await markNotificationsRead({
      userId: actor.user.userId,
      ids: parsed.data.ids,
      all: parsed.data.all === true,
    });

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[Notifications] mark read failed:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications read" },
      { status: 500 }
    );
  }
}
