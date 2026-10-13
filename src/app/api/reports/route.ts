import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import { createReport, REPORT_REASONS } from "@/lib/safety/reports";

const bodySchema = z
  .object({
    reason: z.enum(REPORT_REASONS as [string, ...string[]]),
    details: z.string().max(2000).optional().nullable(),
    contactRequestId: z.string().uuid().optional().nullable(),
    conversationId: z.string().uuid().optional().nullable(),
    reportedWorkerProfileId: z.string().uuid().optional().nullable(),
    reportedVenueId: z.string().uuid().optional().nullable(),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({ role: ["worker", "recruiter"] });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report payload" }, { status: 400 });
    }

    const result = await createReport({
      reporterUserId: actor.user.userId,
      reason: parsed.data.reason as (typeof REPORT_REASONS)[number],
      details: parsed.data.details,
      contactRequestId: parsed.data.contactRequestId,
      conversationId: parsed.data.conversationId,
      reportedWorkerProfileId: parsed.data.reportedWorkerProfileId,
      reportedVenueId: parsed.data.reportedVenueId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      reportId: result.report.id,
      autoPaused: result.autoPaused,
    });
  } catch (error) {
    console.error("[Reports] create failed:", error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}
