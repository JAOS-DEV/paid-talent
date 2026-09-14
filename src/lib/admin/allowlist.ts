export interface AdminAuthResult {
  isAdmin: boolean;
  email: string | null;
  reason: "authorized" | "not_in_allowlist" | "no_email" | "no_allowlist";
}

/**
 * Server-side ADMIN_EMAILS parser. Edge-safe: env only, no DB.
 * Never import this from client components. The allowlist contents
 * must not be sent to the browser.
 */
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

export function isAdminEmail(
  email: string | null | undefined
): AdminAuthResult {
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

/**
 * Session capability boolean derived from the authenticated email.
 * Pending signup JWTs never receive admin capability.
 */
export function resolveSessionIsAdmin(input: {
  email: string | null | undefined;
  signupPending?: boolean;
  userId?: string;
}): boolean {
  if (input.signupPending === true) {
    return false;
  }
  if (!input.userId) {
    return false;
  }
  return isAdminEmail(input.email).isAdmin;
}
