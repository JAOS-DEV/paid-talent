/**
 * Normalize a provider-verified email for durable identity matching.
 * Only server-verified emails should be passed here.
 */
export function normalizeVerifiedEmail(
  email: string | null | undefined
): string | null {
  if (!email) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return null;
  }
  return normalized;
}

export function emailsMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = normalizeVerifiedEmail(left);
  const b = normalizeVerifiedEmail(right);
  return a !== null && a === b;
}
