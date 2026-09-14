export interface AdminAuthResult {
  isAdmin: boolean;
  email: string | null;
  reason: "authorized" | "not_in_allowlist" | "no_email" | "no_allowlist";
}

export {
  resolveAdminPageAccess,
  requireAdminPage,
  type AdminPageAccess,
} from "./guard";

export {
  buildVerificationDecisionBody,
  buildPhotoRejectBody,
  canSubmitVerificationApprove,
} from "./review-actions";

export function getAdminEmailAllowlist(): string[] {
  const envValue = process.env.ADMIN_EMAILS;
  if (!envValue) {
    return [];
  }
  return envValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isAdminEmail(email: string | null | undefined): AdminAuthResult {
  if (!email) {
    return {
      isAdmin: false,
      email: null,
      reason: "no_email",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const allowlist = getAdminEmailAllowlist();

  if (allowlist.length === 0) {
    return {
      isAdmin: false,
      email: normalizedEmail,
      reason: "no_allowlist",
    };
  }

  const isAdmin = allowlist.includes(normalizedEmail);

  return {
    isAdmin,
    email: normalizedEmail,
    reason: isAdmin ? "authorized" : "not_in_allowlist",
  };
}
