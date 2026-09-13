import type { PhotoModerationStatus } from "@/lib/db/schema";

export const MAX_PROFILE_PHOTOS = 5;
export const MAX_PENDING_PHOTOS = 1;

export const PHOTO_POLICY_COPY = {
  helper:
    "Add a clear photo so venues recognise you. Face visible preferred.",
  rules: "No nudes. Lingerie OK — we'll review before it goes live.",
  pending:
    "Photo under review — your profile stays visible with your previous photo until approved.",
  rejected:
    "This photo didn't meet our guidelines. Try a clear, face-forward shot without nudity.",
} as const;

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

export interface PhotoLimitCheck {
  canUpload: boolean;
  reason?: string;
  currentApprovedCount: number;
  currentPendingCount: number;
}

export function checkPhotoLimits(
  approvedCount: number,
  pendingCount: number
): PhotoLimitCheck {
  if (pendingCount >= MAX_PENDING_PHOTOS) {
    return {
      canUpload: false,
      reason: PHOTO_POLICY_COPY.pending,
      currentApprovedCount: approvedCount,
      currentPendingCount: pendingCount,
    };
  }

  if (approvedCount >= MAX_PROFILE_PHOTOS) {
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
