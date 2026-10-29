import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runMessagingMaintenance } from "@/lib/contact-requests";
import { retryPending } from "@/lib/notifications";
import { runMessagingRetention } from "@/lib/jobs/messaging-retention";
import { runAccountPurge } from "@/lib/account/deletion";
import { runVerificationMediaRetentionJob } from "@/lib/jobs/id-document-retention";

interface MaintenanceFailure {
  step: string;
  error: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function bearerMatches(authorization: string | null, secret: string): boolean {
  if (!authorization) {
    return false;
  }
  const provided = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

async function runStep<T>(
  step: string,
  failures: MaintenanceFailure[],
  run: () => Promise<T>
): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`[Cron] messaging-maintenance ${step} failed:`, error);
    failures.push({ step, error: errorMessage(error) });
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const failures: MaintenanceFailure[] = [];
  const now = new Date();
  const messagingMaintenance = await runStep(
    "messagingMaintenance",
    failures,
    () => runMessagingMaintenance(now)
  );
  const notifications = await runStep("notifications", failures, async () => ({
    notificationsRetried: await retryPending(now),
  }));
  const retention = await runStep("retention", failures, () =>
    runMessagingRetention(now)
  );
  const verificationMedia = await runStep(
    "verificationMedia",
    failures,
    () => runVerificationMediaRetentionJob()
  );
  const accountPurge = await runStep("accountPurge", failures, () =>
    runAccountPurge(now)
  );

  const succeeded = [
    messagingMaintenance,
    notifications,
    retention,
    verificationMedia,
    accountPurge,
  ].filter((result) => result !== null);

  const body = {
    ok: succeeded.length > 0,
    messagingMaintenance,
    notificationsRetried: notifications?.notificationsRetried ?? null,
    retention,
    accountPurge,
    verificationMedia: verificationMedia
      ? {
          processed: verificationMedia.processed,
          idDocumentsDeleted: verificationMedia.idDocumentsDeleted,
          livenessVideosDeleted: verificationMedia.livenessVideosDeleted,
          errors: verificationMedia.errors,
          skipped: verificationMedia.skipped,
        }
      : null,
    failed: failures,
  };

  console.log("[Cron] messaging-maintenance", body);

  if (succeeded.length === 0) {
    return NextResponse.json(body, { status: 500 });
  }

  return NextResponse.json(body);
}
