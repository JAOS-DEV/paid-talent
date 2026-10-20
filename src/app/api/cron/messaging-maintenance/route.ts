import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runMessagingMaintenance } from "@/lib/contact-requests";
import { retryPending } from "@/lib/notifications";
import { runMessagingRetention } from "@/lib/jobs/messaging-retention";
import { runAccountPurge } from "@/lib/account/deletion";
import { runVerificationMediaRetentionJob } from "@/lib/jobs/id-document-retention";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const counts = await runMessagingMaintenance();
    const notificationsRetried = await retryPending();
    const retention = await runMessagingRetention(now);
    const accountPurge = await runAccountPurge(now);
    const verificationMedia = await runVerificationMediaRetentionJob();
    console.log("[Cron] messaging-maintenance", {
      notificationsRetried,
      retention,
      accountPurge,
      verificationMedia: {
        processed: verificationMedia.processed,
        idDocumentsDeleted: verificationMedia.idDocumentsDeleted,
        livenessVideosDeleted: verificationMedia.livenessVideosDeleted,
        errors: verificationMedia.errors,
        skipped: verificationMedia.skipped,
      },
    });
    return NextResponse.json({
      ok: true,
      ...counts,
      notificationsRetried,
      retention,
      accountPurge,
      verificationMedia: {
        processed: verificationMedia.processed,
        idDocumentsDeleted: verificationMedia.idDocumentsDeleted,
        livenessVideosDeleted: verificationMedia.livenessVideosDeleted,
        errors: verificationMedia.errors,
        skipped: verificationMedia.skipped,
      },
    });
  } catch (error) {
    console.error("[Cron] messaging-maintenance failed:", error);
    return NextResponse.json(
      { error: "Messaging maintenance failed" },
      { status: 500 }
    );
  }
}
