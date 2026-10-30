const TOKEN_LABELS: Record<string, string> = {
  pending: "Pending",
  verified: "Verified",
  unverified: "Not verified",
  approved: "Approved",
  rejected: "Rejected",
  reviewing: "Reviewing",
  actioned: "Actioned",
  dismissed: "Dismissed",
  open: "Open",
  closed: "Closed",
  active: "Active",
  suspended: "Suspended",
  worker: "Talent",
  recruiter: "Venue",
  scam_or_fake_job: "Scam or fake job",
  asked_for_money: "Asked for money",
  asked_for_documents: "Asked for documents",
  harassment: "Harassment",
  sexual_content: "Sexual content",
  underage_concern: "Under 20",
  trafficking_concern: "Trafficking concern",
  spam: "Spam",
  other: "Other",
  contact_shared_in_text: "Contact shared in text",
  money_request: "Money request",
  documents: "Documents",
  overseas: "Overseas",
  scam_work: "Scam work",
  off_platform: "Off platform",
  explicit_nudity: "Explicit nudity",
  suggestive: "Suggestive",
  violence: "Violence",
  identity_verification_approved: "Identity verification approved",
  identity_verification_rejected: "Identity verification rejected",
  identity_verification_revoked: "Identity verification revoked",
  recruiter_verification_approved: "Venue verification approved",
  recruiter_verification_rejected: "Venue verification rejected",
  recruiter_verification_revoked: "Venue verification revoked",
  google_maps: "Google Maps",
  facebook: "Facebook",
  instagram: "Instagram",
};

export function labelForToken(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  if (TOKEN_LABELS[value]) {
    return TOKEN_LABELS[value];
  }
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export type AdminPillVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error";

const STATUS_VARIANT: Record<string, AdminPillVariant> = {
  pending: "warning",
  pending_review: "warning",
  reviewing: "warning",
  open: "warning",
  unverified: "default",
  verified: "success",
  approved: "success",
  actioned: "success",
  active: "success",
  rejected: "error",
  dismissed: "default",
  suspended: "error",
  closed: "default",
  expired: "default",
};

export function statusPillVariant(
  status: string | null | undefined
): AdminPillVariant {
  return STATUS_VARIANT[status ?? ""] ?? "default";
}
