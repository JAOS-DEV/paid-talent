import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { rejectPhoto, PHOTO_POLICY_COPY } from "@/lib/moderation";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const rejectSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = isAdminEmail(session.user.email);

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        {
          error: "Forbidden",
          reason: adminCheck.reason,
        },
        { status: 403 }
      );
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      const validation = rejectSchema.safeParse(body);
      if (validation.success) {
        reason = validation.data.reason;
      }
    } catch {
      // Body is optional, continue without reason
    }

    const result = await rejectPhoto(
      id,
      session.user.email ?? session.user.id,
      reason
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Photo rejected",
      userMessage: PHOTO_POLICY_COPY.rejected,
    });
  } catch (error) {
    console.error("[Admin Photo Reject] Error:", error);
    return NextResponse.json(
      { error: "Failed to reject photo" },
      { status: 500 }
    );
  }
}
