import type { PhotoModerationStatus } from "@/lib/db/schema";

export const MAX_PROFILE_PHOTOS = 5;
/** Conservative cap for competing PRIMARY verification-photo submissions. */
export const MAX_PENDING_PHOTOS = 1;

export function occupiedPhotoSlotCount(
  approvedCount: number,
  pendingCount: number
): number {
  return Math.max(0, approvedCount) + Math.max(0, pendingCount);
}

export type PhotoUploadPurpose = "primary" | "gallery";

export const GALLERY_UNVERIFIED_REASON =
  "Additional photos are available after identity verification is approved.";

export const PHOTO_POLICY_COPY = {
  helper:
    "Add a clear photo so venues recognise you. Face visible preferred.",
  rules: "No nudes. We'll review each photo before it goes live.",
  pending: "This photo will appear on your profile after it is approved.",
  rejected:
    "This photo didn't meet our guidelines. Try a clear, face-forward shot without nudity.",
  primaryLocked:
    "Make another photo primary before removing this one.",
} as const;

/**
 * Current MVP publication mode. Analyzer results are advisory only and must
 * never approve, reject, or publish a profile photo.
 */
export const PHOTO_MODERATION_PUBLICATION_MODE = "manual" as const;

export type PhotoContentCategory =
  | "explicit_nudity"
  | "suggestive"
  | "lingerie_swimwear"
  | "violence"
  | "hate_symbols"
  | "drugs"
  | "safe"
  | "unknown";

export interface PhotoAnalysisResult {
  categories: PhotoContentCategory[];
  confidence: number;
  rawLabels?: string[];
}

export type PhotoPolicyDecision = {
  action: "approve" | "reject" | "quarantine";
  status: PhotoModerationStatus;
  reason: string;
  requiresReview: boolean;
};

export function applyPhotoPolicy(
  analysis: PhotoAnalysisResult
): PhotoPolicyDecision {
  const { categories, confidence } = analysis;

  const hasExplicitNudity = categories.includes("explicit_nudity");
  if (hasExplicitNudity) {
    return {
      action: "reject",
      status: "rejected",
      reason: "Explicit nudity not allowed",
      requiresReview: false,
    };
  }

  const hasViolence = categories.includes("violence");
  const hasHateSymbols = categories.includes("hate_symbols");
  const hasDrugs = categories.includes("drugs");
  if (hasViolence || hasHateSymbols || hasDrugs) {
    return {
      action: "reject",
      status: "rejected",
      reason: "Content violates community guidelines",
      requiresReview: false,
    };
  }

  const hasLingerieSwimwear = categories.includes("lingerie_swimwear");
  const hasSuggestive = categories.includes("suggestive");
  if (hasLingerieSwimwear || hasSuggestive) {
    return {
      action: "quarantine",
      status: "pending",
      reason: "Lingerie/swimwear content requires manual review",
      requiresReview: true,
    };
  }

  if (confidence < 0.7) {
    return {
      action: "quarantine",
      status: "pending",
      reason: "Low confidence score requires manual review",
      requiresReview: true,
    };
  }

  const hasSafeContent = categories.includes("safe");
  const hasUnknown = categories.includes("unknown");
  if (hasUnknown && !hasSafeContent) {
    return {
      action: "quarantine",
      status: "pending",
      reason: "Ambiguous content requires manual review",
      requiresReview: true,
    };
  }

  return {
    action: "approve",
    status: "approved",
    reason: "Content meets guidelines",
    requiresReview: false,
  };
}

export function decidePhotoSubmission(
  analysis: PhotoAnalysisResult
): PhotoPolicyDecision {
  const advisory = applyPhotoPolicy(analysis);

  if (PHOTO_MODERATION_PUBLICATION_MODE === "manual") {
    return {
      action: "quarantine",
      status: "pending",
      reason: advisory.reason,
      requiresReview: true,
    };
  }

  return advisory;
}

export interface PhotoLimitCheck {
  canUpload: boolean;
  reason?: string;
  currentApprovedCount: number;
  currentPendingCount: number;
}

export interface PhotoLimitOptions {
  isVerified?: boolean;
  purpose?: PhotoUploadPurpose;
}

export function checkPhotoLimits(
  approvedCount: number,
  pendingCount: number,
  options: PhotoLimitOptions = {}
): PhotoLimitCheck {
  const purpose = options.purpose ?? "primary";
  const isVerified = options.isVerified === true;

  if (purpose === "gallery" && !isVerified) {
    return {
      canUpload: false,
      reason: GALLERY_UNVERIFIED_REASON,
      currentApprovedCount: approvedCount,
      currentPendingCount: pendingCount,
    };
  }

  if (purpose === "primary" && pendingCount >= MAX_PENDING_PHOTOS) {
    return {
      canUpload: false,
      reason: PHOTO_POLICY_COPY.pending,
      currentApprovedCount: approvedCount,
      currentPendingCount: pendingCount,
    };
  }

  const slotCount = occupiedPhotoSlotCount(approvedCount, pendingCount);
  if (slotCount >= MAX_PROFILE_PHOTOS || approvedCount >= MAX_PROFILE_PHOTOS) {
    return {
      canUpload: false,
      reason: `Maximum of ${MAX_PROFILE_PHOTOS} profile photos allowed`,
      currentApprovedCount: approvedCount,
      currentPendingCount: pendingCount,
    };
  }

  return {
    canUpload: true,
    currentApprovedCount: approvedCount,
    currentPendingCount: pendingCount,
  };
}
