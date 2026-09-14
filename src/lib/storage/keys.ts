export const PUBLIC_MEDIA_KEY_PREFIX = "profiles/";
export const PRIVATE_PHOTO_STAGING_PREFIX = "profile-photo-staging/";
export const PRIVATE_ID_KEY_PREFIX = "verification-docs/";
export const PRIVATE_LIVENESS_KEY_PREFIX = "verification-liveness/";

export type PrivateVerificationObjectKind = "id" | "liveness";

function normalizeObjectKey(key: string): string {
  return key.replace(/^\/+/, "");
}

export function isPrivatePhotoStagingKey(key: string): boolean {
  return normalizeObjectKey(key).startsWith(PRIVATE_PHOTO_STAGING_PREFIX);
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
    isPrivatePhotoStagingKey(normalized) ||
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

export function assertOwnedPublicProfilePhotoKey(
  userId: string,
  key: string
): void {
  assertPublicMediaObjectKey(key);
  const prefix = `${PUBLIC_MEDIA_KEY_PREFIX}${userId}/`;
  if (!normalizeObjectKey(key).startsWith(prefix)) {
    throw new Error("PUBLIC_MEDIA_KEY_NOT_OWNED");
  }
}

export function assertPhotoStagingObjectKey(key: string): void {
  const normalized = normalizeObjectKey(key);
  if (
    !normalized ||
    normalized.includes("..") ||
    !normalized.startsWith(PRIVATE_PHOTO_STAGING_PREFIX)
  ) {
    throw new Error("PHOTO_STAGING_INVALID_KEY");
  }
}

export function assertOwnedPhotoStagingKey(userId: string, key: string): void {
  assertPhotoStagingObjectKey(key);
  const prefix = `${PRIVATE_PHOTO_STAGING_PREFIX}${userId}/`;
  if (!normalizeObjectKey(key).startsWith(prefix)) {
    throw new Error("PHOTO_STAGING_KEY_NOT_OWNED");
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
