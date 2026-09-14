export const PUBLIC_MEDIA_KEY_PREFIX = "profiles/";
export const PRIVATE_ID_KEY_PREFIX = "verification-docs/";
export const PRIVATE_LIVENESS_KEY_PREFIX = "verification-liveness/";

export type PrivateVerificationObjectKind = "id" | "liveness";

function normalizeObjectKey(key: string): string {
  return key.replace(/^\/+/, "");
}

export function isPrivateVerificationObjectKey(key: string): boolean {
  const normalized = normalizeObjectKey(key);
  return (
    normalized.startsWith(PRIVATE_ID_KEY_PREFIX) ||
    normalized.startsWith(PRIVATE_LIVENESS_KEY_PREFIX)
  );
}

export function isForbiddenPublicMediaKey(key: string): boolean {
  const normalized = normalizeObjectKey(key);
  return (
    isPrivateVerificationObjectKey(normalized) ||
    normalized.startsWith("documents/") ||
    normalized.startsWith("verification-")
  );
}

export function assertPublicMediaObjectKey(key: string): void {
  const normalized = normalizeObjectKey(key);
  if (
    !normalized ||
    normalized.includes("..") ||
    isForbiddenPublicMediaKey(normalized) ||
    !normalized.startsWith(PUBLIC_MEDIA_KEY_PREFIX)
  ) {
    throw new Error("PUBLIC_MEDIA_FORBIDDEN_KEY");
  }
}

export function assertPrivateVerificationObjectKey(
  key: string,
  kind?: PrivateVerificationObjectKind
): void {
  const normalized = normalizeObjectKey(key);
  if (!normalized || normalized.includes("..")) {
    throw new Error("PRIVATE_VERIFICATION_INVALID_KEY");
  }

  if (kind === "id" && !normalized.startsWith(PRIVATE_ID_KEY_PREFIX)) {
    throw new Error("PRIVATE_VERIFICATION_INVALID_KEY");
  }

  if (
    kind === "liveness" &&
    !normalized.startsWith(PRIVATE_LIVENESS_KEY_PREFIX)
  ) {
    throw new Error("PRIVATE_VERIFICATION_INVALID_KEY");
  }

  if (!kind && !isPrivateVerificationObjectKey(normalized)) {
    throw new Error("PRIVATE_VERIFICATION_INVALID_KEY");
  }
}

export function assertOwnedPrivateVerificationKey(
  userId: string,
  key: string,
  kind: PrivateVerificationObjectKind
): void {
  assertPrivateVerificationObjectKey(key, kind);
  const normalized = normalizeObjectKey(key);
  const prefix =
    kind === "id"
      ? `${PRIVATE_ID_KEY_PREFIX}${userId}/`
      : `${PRIVATE_LIVENESS_KEY_PREFIX}${userId}/`;

  if (!normalized.startsWith(prefix)) {
    throw new Error("PRIVATE_VERIFICATION_KEY_NOT_OWNED");
  }
}
