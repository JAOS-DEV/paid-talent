export const USER_REJECTION_REASON_CODES = [
  "document_unreadable",
  "face_mismatch",
  "liveness_failed",
  "document_expired",
  "other",
] as const;

export type UserRejectionReasonCode =
  (typeof USER_REJECTION_REASON_CODES)[number];

export function isUserRejectionReasonCode(
  value: string | null | undefined
): value is UserRejectionReasonCode {
  return (
    typeof value === "string" &&
    (USER_REJECTION_REASON_CODES as readonly string[]).includes(value)
  );
}
