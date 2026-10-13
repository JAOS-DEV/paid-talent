import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { db } from "@/lib/db";
import { lineLinks } from "@/lib/db/schema";

export async function POST(): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    await db
      .delete(lineLinks)
      .where(eq(lineLinks.userId, actor.user.userId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LINE unlink] failed:", error);
    return NextResponse.json(
      { error: "Failed to unlink LINE" },
      { status: 500 }
    );
  }
}
