import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  getMessagingSettings,
  messagingSettingsPatchSchema,
  updateMessagingSettings,
  type MessagingSettingsSnapshot,
} from "@/lib/messaging/settings";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { revalidatePath } from "next/cache";

const putSchema = z
  .object({
    reason: z.string().min(3).max(1000),
  })
  .and(messagingSettingsPatchSchema);

function serializeSettings(settings: MessagingSettingsSnapshot) {
  return {
    id: settings.id,
    freeDailyNew: settings.freeDailyNew,
    freeWeeklyNew: settings.freeWeeklyNew,
    freePendingMax: settings.freePendingMax,
    freeOpenerMaxChars: settings.freeOpenerMaxChars,
    freeCanAttachOpening: settings.freeCanAttachOpening,
    freeMaxVenues: settings.freeMaxVenues,
    paidDailyNew: settings.paidDailyNew,
    paidWeeklyNew: settings.paidWeeklyNew,
    paidDailyTopTalent: settings.paidDailyTopTalent,
    paidPendingMax: settings.paidPendingMax,
    paidOpenerMaxChars: settings.paidOpenerMaxChars,
    paidMaxVenues: settings.paidMaxVenues,
    newRecruiterDailyCap: settings.newRecruiterDailyCap,
    newRecruiterWindowDays: settings.newRecruiterWindowDays,
    workerInboundDailyDefault: settings.workerInboundDailyDefault,
    followUpAfterHours: settings.followUpAfterHours,
    requestExpiryDays: settings.requestExpiryDays,
    declineCooldownDays: settings.declineCooldownDays,
    messageMaxChars: settings.messageMaxChars,
    autoPauseReportThreshold: settings.autoPauseReportThreshold,
    autoPauseWindowDays: settings.autoPauseWindowDays,
    notifyCooldownMinutes: settings.notifyCooldownMinutes,
    lineMonthlyPushBudget: settings.lineMonthlyPushBudget,
    retentionDays: settings.retentionDays,
    updatedAt: settings.updatedAt.toISOString(),
    updatedBy: settings.updatedBy,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const settings = await getMessagingSettings();
    return NextResponse.json({ settings: serializeSettings(settings) });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin messaging settings GET]", error);
    return NextResponse.json(
      { error: "Failed to load messaging settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid messaging settings",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { reason, ...patch } = parsed.data;

    const result = await updateMessagingSettings({
      patch,
      reason,
      adminEmail: guard.actor.email,
      adminUserId: guard.actor.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          errors: result.fieldErrors,
        },
        { status: result.status }
      );
    }

    revalidatePath("/admin/settings");

    return NextResponse.json({
      success: true,
      settings: serializeSettings(result.settings),
    });
  } catch (error) {
    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }
    console.error("[Admin messaging settings PUT]", error);
    return NextResponse.json(
      { error: "Failed to update messaging settings" },
      { status: 500 }
    );
  }
}
