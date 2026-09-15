import { createHash, randomInt } from "crypto";
import type {
  VerificationStatus,
  VerificationDecision,
  WorkerProfile,
} from "@/lib/db/schema";

const CHALLENGE_CODE_LENGTH = 6;
const CHALLENGE_CODE_EXPIRY_MINUTES = 30;

export function generateChallengeCode(): string {
  const min = Math.pow(10, CHALLENGE_CODE_LENGTH - 1);
  const max = Math.pow(10, CHALLENGE_CODE_LENGTH) - 1;
  return randomInt(min, max + 1).toString();
}

export function formatChallengeCodeForDisplay(code: string): string {
  return code.slice(0, 3) + "-" + code.slice(3);
}

export function isChallengeCodeExpired(issuedAt: Date): boolean {
  const now = new Date();
  const expiryTime = new Date(issuedAt);
  expiryTime.setMinutes(expiryTime.getMinutes() + CHALLENGE_CODE_EXPIRY_MINUTES);
  return now > expiryTime;
}

export { CHALLENGE_CODE_EXPIRY_MINUTES };

export interface SearchableWorkerResult {
  isSearchable: boolean;
  reason:
    | "verified"
    | "not_verified"
    | "not_published"
    | "pending_verification"
    | "rejected"
    | "photo_pending";
}

export function isSearchableWorker(
  profile: Pick<
    WorkerProfile,
    "verificationStatus" | "isPublished" | "photoKey" | "photoUrl"
  > | null
): SearchableWorkerResult {
  if (!profile) {
    return {
      isSearchable: false,
      reason: "not_verified",
    };
  }

  if (!profile.isPublished) {
    return {
      isSearchable: false,
      reason: "not_published",
    };
  }

  if (profile.verificationStatus === "verified") {
    if (!profile.photoKey || !profile.photoUrl) {
      return {
        isSearchable: false,
        reason: "photo_pending",
      };
    }

    return {
      isSearchable: true,
      reason: "verified",
    };
  }

  if (profile.verificationStatus === "pending") {
    return {
      isSearchable: false,
      reason: "pending_verification",
    };
  }

  if (profile.verificationStatus === "rejected") {
    return {
      isSearchable: false,
      reason: "rejected",
    };
  }

  return {
    isSearchable: false,
    reason: "not_verified",
  };
}

export function isVerifiedStatus(status: VerificationStatus): boolean {
  return status === "verified";
}

export interface VerificationTransitionResult {
  allowed: boolean;
  reason: string;
}

const VALID_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  unverified: ["pending"],
  pending: ["verified", "rejected"],
  verified: ["rejected"],
  rejected: ["pending"],
};

export function canTransitionVerificationStatus(
  from: VerificationStatus,
  to: VerificationStatus
): VerificationTransitionResult {
  if (from === to) {
    return {
      allowed: false,
      reason: `Status is already ${from}`,
    };
  }

  const allowedTargets = VALID_TRANSITIONS[from];

  if (allowedTargets.includes(to)) {
    return {
      allowed: true,
      reason: `Transition from ${from} to ${to} is allowed`,
    };
  }

  return {
    allowed: false,
    reason: `Cannot transition from ${from} to ${to}. Allowed transitions: ${allowedTargets.join(", ") || "none"}`,
  };
}

export function getVerificationStatusDescription(
  status: VerificationStatus
): string {
  const descriptions: Record<VerificationStatus, string> = {
    unverified: "Worker has not submitted ID documents for verification",
    pending: "ID documents submitted, awaiting admin review",
    verified: "ID verified by admin, worker is searchable",
    rejected: "ID verification rejected by admin",
  };
  return descriptions[status];
}

export function decisionToStatus(
  decision: VerificationDecision
): VerificationStatus {
  const mapping: Record<VerificationDecision, VerificationStatus> = {
    pending_submitted: "pending",
    approved: "verified",
    rejected: "rejected",
    revoked: "rejected",
  };
  return mapping[decision];
}

export function computeFileSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function computeFileSha256FromStream(
  stream: ReadableStream<Uint8Array>
): Promise<string> {
  const hash = createHash("sha256");
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }

  return hash.digest("hex");
}

export function getRetentionExpiryDate(
  decisionDate: Date,
  retentionDays: number = 30
): Date {
  const expiryDate = new Date(decisionDate);
  expiryDate.setDate(expiryDate.getDate() + retentionDays);
  return expiryDate;
}

export const VERIFICATION_RETENTION_DAYS = parseInt(
  process.env.RETENTION_DAYS || "30",
  10
);

export interface VerificationSubmissionData {
  idDocumentKey: string | null;
  livenessVideoKey: string | null;
  challengeCode: string | null;
  challengeIssuedAt: Date | null;
  boundIdDocumentKey?: string | null;
}

export interface VerificationSubmissionValidation {
  isValid: boolean;
  errors: string[];
}

export function validateVerificationSubmission(
  data: VerificationSubmissionData
): VerificationSubmissionValidation {
  const errors: string[] = [];

  if (!data.idDocumentKey) {
    errors.push("ID document is required");
  }

  if (!data.livenessVideoKey) {
    errors.push("Liveness video is required");
  }

  if (!data.challengeCode) {
    errors.push("Challenge code is required");
  }

  if (!data.challengeIssuedAt) {
    errors.push("Challenge code was not properly issued");
  } else if (isChallengeCodeExpired(data.challengeIssuedAt)) {
    errors.push("Challenge code has expired. Please request a new one.");
  }

  if (
    data.boundIdDocumentKey &&
    data.idDocumentKey &&
    data.boundIdDocumentKey !== data.idDocumentKey
  ) {
    errors.push(
      "ID document does not match the document used to start video verification"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface AdminApprovalValidation {
  canApprove: boolean;
  errors: string[];
}

export function validateAdminApproval(
  profile: Pick<
    WorkerProfile,
    | "idDocumentKey"
    | "livenessVideoKey"
    | "challengeCode"
    | "verificationStatus"
  >
): AdminApprovalValidation {
  const errors: string[] = [];

  if (!profile.idDocumentKey) {
    errors.push("Cannot approve: ID document is missing");
  }

  if (!profile.livenessVideoKey) {
    errors.push("Cannot approve: Liveness video is missing");
  }

  if (!profile.challengeCode) {
    errors.push("Cannot approve: Challenge code record is missing");
  }

  if (profile.verificationStatus !== "pending") {
    errors.push(
      `Cannot approve: Profile is not in pending status (current: ${profile.verificationStatus})`
    );
  }

  return {
    canApprove: errors.length === 0,
    errors,
  };
}

export const WORKER_VERIFICATION_FORBIDDEN_FIELDS = [
  "idDocumentKey",
  "livenessVideoKey",
  "idDocumentUrl",
  "livenessVideoUrl",
] as const;

export function toWorkerVerificationStatusDto(profile: {
  verificationStatus: string;
  idDocumentSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  challengeCode: string | null;
}): {
  verificationStatus: string;
  idDocumentSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  hasIdDocument: boolean;
  hasChallengeCode: boolean;
} {
  return {
    verificationStatus: profile.verificationStatus,
    idDocumentSubmittedAt: profile.idDocumentSubmittedAt,
    verificationReviewedAt: profile.verificationReviewedAt,
    hasIdDocument: Boolean(profile.idDocumentSubmittedAt),
    hasChallengeCode: Boolean(profile.challengeCode),
  };
}
