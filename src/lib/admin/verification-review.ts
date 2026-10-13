import { eq } from "drizzle-orm";
import { db, users, verificationEvents } from "@/lib/db";
import type {
  AdminAuditAction,
  DocType,
  VerificationDecision,
  VerificationStatus,
} from "@/lib/db/schema";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  canTransitionVerificationStatus,
  computeFileSha256,
  getRetentionExpiryDate,
  validateAdminApproval,
  VERIFICATION_RETENTION_DAYS,
} from "@/lib/verification";
import {
  getVerificationSubject,
  type SubjectType,
} from "@/lib/verification/subject";
import {
  getIdDocumentBufferForAdmin,
  getLivenessVideoBufferForAdmin,
} from "@/lib/storage/s3";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import { notify } from "@/lib/notifications";

export type VerificationReviewAction = "approve" | "reject" | "revoke";

export interface ReviewSubjectInput {
  subjectType: SubjectType;
  profileId: string;
  action: VerificationReviewAction;
  docType?: DocType;
  last4?: string;
  issuingCountry?: string;
  notes?: string;
  admin: {
    userId: string;
    email: string;
  };
}

export type ReviewSubjectResult =
  | {
      ok: true;
      profile: {
        id: string;
        userId: string;
        displayName: string | null;
        verificationStatus: VerificationStatus;
        verificationReviewedAt: Date | null;
        verificationReviewedBy: string | null;
        verifiedAt: Date | null;
      };
      action: VerificationReviewAction;
      eventLogged: true;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details?: string[];
      reason?: string;
      currentStatus?: VerificationStatus;
      targetStatus?: VerificationStatus;
    };

function recruiterActionToAudit(
  action: VerificationReviewAction
): AdminAuditAction {
  if (action === "approve") {
    return "recruiter_verification_approved";
  }
  if (action === "revoke") {
    return "recruiter_verification_revoked";
  }
  return "recruiter_verification_rejected";
}

function workerActionToAudit(
  action: VerificationReviewAction
): AdminAuditAction {
  if (action === "approve") {
    return "identity_verification_approved";
  }
  if (action === "revoke") {
    return "identity_verification_revoked";
  }
  return "identity_verification_rejected";
}

export async function reviewSubject(
  input: ReviewSubjectInput
): Promise<ReviewSubjectResult> {
  const subject = getVerificationSubject(input.subjectType);
  const existingProfile = await subject.loadById(input.profileId);

  if (!existingProfile) {
    return {
      ok: false,
      status: 404,
      error: subject.profileNotFoundError,
    };
  }

  if (input.action === "approve") {
    const approvalValidation = validateAdminApproval({
      idDocumentKey: existingProfile.idDocumentKey,
      livenessVideoKey: existingProfile.livenessVideoKey,
      challengeCode: existingProfile.challengeCode,
      verificationStatus: existingProfile.verificationStatus,
    });

    if (!approvalValidation.canApprove) {
      return {
        ok: false,
        status: 400,
        error: "Cannot approve verification",
        details: approvalValidation.errors,
      };
    }
  }

  const targetStatus: VerificationStatus =
    input.action === "approve" ? "verified" : "rejected";

  const transitionCheck = canTransitionVerificationStatus(
    existingProfile.verificationStatus,
    targetStatus
  );

  if (!transitionCheck.allowed) {
    return {
      ok: false,
      status: 400,
      error: "Invalid status transition",
      reason: transitionCheck.reason,
      currentStatus: existingProfile.verificationStatus,
      targetStatus,
    };
  }

  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.admin.email))
    .limit(1);

  const now = new Date();

  let idDocumentSha256: string | null = null;
  let livenessVideoSha256: string | null = null;

  if (existingProfile.idDocumentKey) {
    try {
      const docBuffer = await getIdDocumentBufferForAdmin(
        input.admin.email,
        existingProfile.idDocumentKey
      );
      idDocumentSha256 = computeFileSha256(docBuffer);
    } catch (error) {
      if (error instanceof PrivateStorageConfigError) {
        return {
          ok: false,
          status: 503,
          error:
            "Verification storage is temporarily unavailable. Please try again later.",
        };
      }
      console.warn(
        `[Admin Verify ${input.subjectType}] Could not compute hash for ID document`
      );
    }
  }

  if (existingProfile.livenessVideoKey) {
    try {
      const videoBuffer = await getLivenessVideoBufferForAdmin(
        input.admin.email,
        existingProfile.livenessVideoKey
      );
      livenessVideoSha256 = computeFileSha256(videoBuffer);
    } catch (error) {
      if (error instanceof PrivateStorageConfigError) {
        return {
          ok: false,
          status: 503,
          error:
            "Verification storage is temporarily unavailable. Please try again later.",
        };
      }
      console.warn(
        `[Admin Verify ${input.subjectType}] Could not compute hash for liveness video`
      );
    }
  }

  const decision: VerificationDecision =
    input.action === "approve"
      ? "approved"
      : input.action === "revoke"
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
    ...subject.eventFk(existingProfile.id),
    decision,
    actorUserId: adminUser?.id ?? null,
    actorType: "admin",
    method: "manual_id_review",
    docType: input.docType ?? null,
    idDocumentKey: existingProfile.idDocumentKey,
    idDocumentSha256,
    livenessVideoKey: existingProfile.livenessVideoKey,
    livenessVideoSha256,
    challengeCode: existingProfile.challengeCode,
    last4: input.last4 ?? null,
    issuingCountry: input.issuingCountry ?? null,
    notes: input.notes ?? null,
    retentionExpiresAt,
    createdAt: now,
  });

  const auditAction =
    input.subjectType === "recruiter"
      ? recruiterActionToAudit(input.action)
      : workerActionToAudit(input.action);

  await recordAdminAuditEvent({
    action: auditAction,
    actorAdminEmail: input.admin.email,
    actorUserId: input.admin.userId,
    targetUserId: existingProfile.userId,
    targetType:
      input.subjectType === "recruiter"
        ? "recruiter_verification"
        : "verification",
    targetId: existingProfile.id,
    reason: input.notes ?? null,
    metadata: {
      decision,
      currentStatus: existingProfile.verificationStatus,
      targetStatus,
    },
    createdAt: now,
  });

  const updatedProfile = await subject.update(existingProfile.id, {
    verificationStatus: targetStatus,
    isVerified: targetStatus === "verified",
    verificationReviewedAt: now,
    verificationReviewedBy: input.admin.email,
    ...(input.subjectType === "recruiter" && input.action === "approve"
      ? { verifiedAt: now }
      : {}),
    updatedAt: now,
  });

  if (input.action === "approve" || input.action === "reject") {
    await notify(
      existingProfile.userId,
      input.action === "approve"
        ? "verification_approved"
        : "verification_rejected",
      {
        profileId: existingProfile.id,
        subjectType: input.subjectType,
      }
    );
  }

  return {
    ok: true,
    profile: {
      id: updatedProfile.id,
      userId: updatedProfile.userId,
      displayName:
        updatedProfile.displayName ?? updatedProfile.organizationName,
      verificationStatus: updatedProfile.verificationStatus,
      verificationReviewedAt: updatedProfile.verificationReviewedAt,
      verificationReviewedBy: updatedProfile.verificationReviewedBy,
      verifiedAt: updatedProfile.verifiedAt,
    },
    action: input.action,
    eventLogged: true,
  };
}
