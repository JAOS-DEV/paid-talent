export const PUBLIC_MEDIA_BUCKET_FALLBACK = "paid-talent-media";
export const PRIVATE_VERIFICATION_BUCKET_FALLBACK = "paid-talent-private";
export const PRIVATE_SIGNED_GET_MAX_SECONDS = 300;

export const PRIVATE_STORAGE_UNAVAILABLE = "PRIVATE_STORAGE_UNAVAILABLE";

export class PrivateStorageConfigError extends Error {
  readonly code: typeof PRIVATE_STORAGE_UNAVAILABLE = PRIVATE_STORAGE_UNAVAILABLE;

  constructor(
    message = "Private verification storage is not configured"
  ) {
    super(message);
    this.name = "PrivateStorageConfigError";
  }
}

export interface PublicMediaStorageConfig {
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string | undefined;
  forcePathStyle: boolean;
  credentialSource: "S3_ACCESS_KEY_ID";
}

export interface PrivateVerificationStorageConfig {
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string | undefined;
  forcePathStyle: boolean;
  credentialSource: "S3_PRIVATE_ACCESS_KEY_ID";
}

function sharedEndpointConfig(): {
  region: string;
  endpoint: string | undefined;
  forcePathStyle: boolean;
} {
  return {
    region: process.env.S3_REGION?.trim() || "us-east-1",
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE),
  };
}

export function getPublicMediaBucketName(): string {
  return process.env.S3_BUCKET_NAME?.trim() || PUBLIC_MEDIA_BUCKET_FALLBACK;
}

export function getPublicMediaStorageConfig(): PublicMediaStorageConfig {
  return {
    ...sharedEndpointConfig(),
    bucketName: getPublicMediaBucketName(),
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || "",
    credentialSource: "S3_ACCESS_KEY_ID",
  };
}

export function getPrivateVerificationStorageConfig(): PrivateVerificationStorageConfig {
  const accessKeyId = process.env.S3_PRIVATE_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.S3_PRIVATE_SECRET_ACCESS_KEY?.trim() || "";
  const bucketName = process.env.S3_PRIVATE_BUCKET_NAME?.trim() || "";
  const publicConfig = getPublicMediaStorageConfig();

  if (!accessKeyId) {
    throw new PrivateStorageConfigError(
      "S3_PRIVATE_ACCESS_KEY_ID is required for verification storage"
    );
  }

  if (!secretAccessKey) {
    throw new PrivateStorageConfigError(
      "S3_PRIVATE_SECRET_ACCESS_KEY is required for verification storage"
    );
  }

  if (!bucketName) {
    throw new PrivateStorageConfigError(
      "S3_PRIVATE_BUCKET_NAME is required for verification storage"
    );
  }

  if (bucketName === publicConfig.bucketName) {
    throw new PrivateStorageConfigError(
      "Private verification bucket must be distinct from the public media bucket"
    );
  }

  if (publicConfig.accessKeyId && accessKeyId === publicConfig.accessKeyId) {
    throw new PrivateStorageConfigError(
      "Private verification credentials must not reuse public media credentials"
    );
  }

  return {
    ...sharedEndpointConfig(),
    bucketName,
    accessKeyId,
    secretAccessKey,
    credentialSource: "S3_PRIVATE_ACCESS_KEY_ID",
  };
}

export function capPrivateSignedGetExpiry(expiresIn?: number): number {
  if (
    expiresIn == null ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    return PRIVATE_SIGNED_GET_MAX_SECONDS;
  }

  return Math.min(Math.floor(expiresIn), PRIVATE_SIGNED_GET_MAX_SECONDS);
}
