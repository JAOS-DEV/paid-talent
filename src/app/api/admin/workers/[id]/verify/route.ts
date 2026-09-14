import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles, verificationEvents, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
import { recordAdminAuditEvent, verificationActionToAudit } from "@/lib/admin/audit";
import {
  canTransitionVerificationStatus,
  getRetentionExpiryDate,
  validateAdminApproval,
  computeFileSha256,
  VERIFICATION_RETENTION_DAYS,
} from "@/lib/verification";
import {
  getIdDocumentBufferForAdmin,
  getLivenessVideoBufferForAdmin,
} from "@/lib/storage/s3";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import type { VerificationStatus, VerificationDecision } from "@/lib/db/schema";
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

    if (!adminCheck.isAdmin) {
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

    const [existingProfile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, profileId))
      .limit(1);

    if (!existingProfile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      const approvalValidation = validateAdminApproval({
        idDocumentKey: existingProfile.idDocumentKey,
        livenessVideoKey: existingProfile.livenessVideoKey,
        challengeCode: existingProfile.challengeCode,
        verificationStatus: existingProfile.verificationStatus,
      });

      if (!approvalValidation.canApprove) {
        return NextResponse.json(
          {
            error: "Cannot approve verification",
            details: approvalValidation.errors,
          },
          { status: 400 }
        );
      }
    }

    const targetStatus: VerificationStatus =
      action === "approve" ? "verified" : "rejected";

    const transitionCheck = canTransitionVerificationStatus(
      existingProfile.verificationStatus,
      targetStatus
    );

    if (!transitionCheck.allowed) {
      return NextResponse.json(
        {
          error: "Invalid status transition",
          reason: transitionCheck.reason,
          currentStatus: existingProfile.verificationStatus,
          targetStatus,
        },
        { status: 400 }
      );
    }

    const [adminUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, adminCheck.email!))
      .limit(1);

    const now = new Date();

    let idDocumentSha256: string | null = null;
    let livenessVideoSha256: string | null = null;

    if (existingProfile.idDocumentKey) {
      try {
        const docBuffer = await getIdDocumentBufferForAdmin(
          adminCheck.email,
          existingProfile.idDocumentKey
        );
        idDocumentSha256 = computeFileSha256(docBuffer);
      } catch (error) {
        if (error instanceof PrivateStorageConfigError) {
          return NextResponse.json(
            {
              error:
                "Verification storage is temporarily unavailable. Please try again later.",
            },
            { status: 503 }
          );
        }
        console.warn(
          "[Admin Verify Worker] Could not compute hash for ID document"
        );
      }
    }

    if (existingProfile.livenessVideoKey) {
      try {
        const videoBuffer = await getLivenessVideoBufferForAdmin(
          adminCheck.email,
          existingProfile.livenessVideoKey
        );
        livenessVideoSha256 = computeFileSha256(videoBuffer);
      } catch (error) {
        if (error instanceof PrivateStorageConfigError) {
          return NextResponse.json(
            {
              error:
                "Verification storage is temporarily unavailable. Please try again later.",
            },
            { status: 503 }
          );
        }
        console.warn(
          "[Admin Verify Worker] Could not compute hash for liveness video"
        );
      }
    }

    const decision: VerificationDecision =
      action === "approve"
        ? "approved"
        : action === "revoke"
          ? "revoked"
          : "rejected";

    const retentionExpiresAt =
      decision === "approved" ||
      decision === "rejected" ||
      decision === "revoked"
        ? getRetentionExpiryDate(now, VERIFICATION_RETENTION_DAYS)
        : null;

    await db.insert(verificationEvents).values({
      userId: existingProfile.userId,
      workerProfileId: existingProfile.id,
      decision,
      actorUserId: adminUser?.id ?? null,
      actorType: "admin",
      method: "manual_id_review",
      docType: docType ?? null,
      idDocumentKey: existingProfile.idDocumentKey,
      idDocumentSha256,
      livenessVideoKey: existingProfile.livenessVideoKey,
      livenessVideoSha256,
      challengeCode: existingProfile.challengeCode,
      last4: last4 ?? null,
      issuingCountry: issuingCountry ?? null,
      notes: notes ?? null,
      retentionExpiresAt,
      createdAt: now,
    });

    await recordAdminAuditEvent({
      action: verificationActionToAudit(action),
      actorAdminEmail: adminCheck.email ?? session.user.email ?? "",
      actorUserId: session.user.id,
      targetUserId: existingProfile.userId,
      targetType: "verification",
      targetId: existingProfile.id,
      reason: notes ?? null,
      metadata: {
        decision,
        currentStatus: existingProfile.verificationStatus,
        targetStatus,
      },
      createdAt: now,
    });

    const [updatedProfile] = await db
      .update(workerProfiles)
      .set({
        verificationStatus: targetStatus,
        isVerified: targetStatus === "verified",
        verificationReviewedAt: now,
        verificationReviewedBy: adminCheck.email,
        updatedAt: now,
      })
      .where(eq(workerProfiles.id, profileId))
      .returning();

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedProfile.id,
        userId: updatedProfile.userId,
        displayName: updatedProfile.displayName,
        verificationStatus: updatedProfile.verificationStatus,
        verificationReviewedAt: updatedProfile.verificationReviewedAt,
        verificationReviewedBy: updatedProfile.verificationReviewedBy,
      },
      action,
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
