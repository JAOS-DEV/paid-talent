import type { VerificationStatus } from "@/lib/db/schema";
import { isChallengeCodeExpired } from "@/lib/verification";

export interface ChallengeIssueGuardResult {
  allowed: boolean;
  reason: string;
}

export function canIssueChallengeCode(
  verificationStatus: VerificationStatus
): ChallengeIssueGuardResult {
  if (
    verificationStatus === "unverified" ||
    verificationStatus === "rejected"
  ) {
    return {
      allowed: true,
      reason: "Challenge can be issued",
    };
  }

  return {
    allowed: false,
    reason: `Cannot generate challenge code. Profile is in ${verificationStatus} status`,
  };
}

export interface LivenessUploadGuardInput {
  challengeCode: string | null;
  challengeIssuedAt: Date | null;
  boundIdDocumentKey: string | null;
  requestedIdDocumentKey?: string | null;
}

export interface LivenessUploadGuardResult {
  allowed: boolean;
  errors: string[];
}

export function canUploadLivenessVideo(
  input: LivenessUploadGuardInput
): LivenessUploadGuardResult {
  const errors: string[] = [];

  if (!input.boundIdDocumentKey) {
    errors.push(
      "ID document must be uploaded before recording a verification video"
    );
  }

  if (!input.challengeCode || !input.challengeIssuedAt) {
    errors.push(
      "Must generate a challenge code before uploading liveness video"
    );
  } else if (isChallengeCodeExpired(input.challengeIssuedAt)) {
    errors.push("Challenge code has expired. Please request a new one.");
  }

  if (!input.requestedIdDocumentKey) {
    errors.push("Liveness video must be bound to the uploaded ID document");
  } else if (
    input.boundIdDocumentKey &&
    input.requestedIdDocumentKey !== input.boundIdDocumentKey
  ) {
    errors.push(
      "Liveness video must be bound to the same ID document used for this challenge"
    );
  }

  return {
    allowed: errors.length === 0,
    errors,
  };
}
