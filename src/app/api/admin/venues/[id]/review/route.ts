import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { reviewVenue } from "@/lib/venues/review";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

const reviewRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) {
      return guard.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = reviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id: venueId } = await params;
    const { action, note } = parsed.data;

    if (action === "reject" && !note?.trim()) {
      return NextResponse.json(
        {
          error: "A note is required when rejecting a venue",
          reason: "note_required",
        },
        { status: 400 }
      );
    }

    const result = await reviewVenue({
      venueId,
      action,
      note,
      admin: guard.actor,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, reason: result.reason },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      venue: {
        id: result.venue.id,
        name: result.venue.name,
        reviewStatus: result.venue.reviewStatus,
        reviewNote: result.venue.reviewNote,
        reviewedAt: result.venue.reviewedAt,
        reviewedBy: result.venue.reviewedBy,
      },
      action: result.action,
      eventLogged: true,
    });
  } catch (error) {
    console.error("[Admin Venue Review] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to review venue" },
      { status: 500 }
    );
  }
}
