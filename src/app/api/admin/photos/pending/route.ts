import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listPendingPhotosForAdmin } from "@/lib/admin/pending-data";
import type { PendingPhotoItem } from "@/lib/admin/pending-data";

export type { PendingPhotoItem };

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

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

    const { photos, count } = await listPendingPhotosForAdmin();

    return NextResponse.json({
      success: true,
      photos,
      count,
    });
  } catch (error) {
    console.error("[Admin Photos Pending] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending photos" },
      { status: 500 }
    );
  }
}
