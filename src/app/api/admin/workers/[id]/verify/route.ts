import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
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
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = isAdminEmail(session.user.email);

    if (!adminCheck.isAdmin || !adminCheck.email) {
      return NextResponse.json(
        {
          error: "Forbidden",
          reason: adminCheck.reason,
        },
        { status: 403 }
      );
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
      subjectType: "worker",
      profileId,
      action,
      docType,
      last4,
      issuingCountry,
      notes,
      admin: {
        userId: session.user.id,
        email: adminCheck.email,
      },
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
        displayName: result.profile.displayName,
        verificationStatus: result.profile.verificationStatus,
        verificationReviewedAt: result.profile.verificationReviewedAt,
        verificationReviewedBy: result.profile.verificationReviewedBy,
      },
      action: result.action,
      eventLogged: true,
    });
  } catch (error) {
    console.error("[Admin Verify Worker] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to verify worker" },
      { status: 500 }
    );
  }
}
