import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { reviewSubject } from "@/lib/admin/verification-review";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

const verifyRequestSchema = z.object({
  action: z.enum(["approve", "reject", "revoke"]),
  docType: z
    .enum(["passport", "thai_id", "drivers_license", "other"])
    .optional(),
  last4: z.string().max(4).optional(),
  issuingCountry: z.string().max(3).optional(),
  notes: z.string().max(500).optional(),
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

    const body = await request.json();
    const parsed = verifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id: profileId } = await params;
    const { action, docType, last4, issuingCountry, notes } = parsed.data;

    const result = await reviewSubject({
      subjectType: "recruiter",
      profileId,
      action,
      docType,
      last4,
      issuingCountry,
      notes,
      admin: guard.actor,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
          reason: result.reason,
          currentStatus: result.currentStatus,
          targetStatus: result.targetStatus,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: result.profile.id,
        userId: result.profile.userId,
        organizationName: result.profile.displayName,
        verificationStatus: result.profile.verificationStatus,
        verificationReviewedAt: result.profile.verificationReviewedAt,
        verificationReviewedBy: result.profile.verificationReviewedBy,
        verifiedAt: result.profile.verifiedAt,
      },
      action: result.action,
      eventLogged: true,
    });
  } catch (error) {
    console.error("[Admin Verify Recruiter] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to verify recruiter" },
      { status: 500 }
    );
  }
}
