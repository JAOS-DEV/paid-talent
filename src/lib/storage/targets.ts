import { v4 as uuidv4 } from "uuid";
import {
  getPrivateVerificationStorageConfig,
  getPublicMediaBucketName,
} from "./config";
import {
  PRIVATE_ID_KEY_PREFIX,
  PRIVATE_LIVENESS_KEY_PREFIX,
  PUBLIC_MEDIA_KEY_PREFIX,
  assertOwnedPrivateVerificationKey,
  assertPublicMediaObjectKey,
} from "./keys";

export interface StorageUploadTarget {
  client: "public" | "private";
  bucket: string;
  key: string;
  credentialSource: "S3_ACCESS_KEY_ID" | "S3_PRIVATE_ACCESS_KEY_ID";
  generatesPublicCdnUrl: boolean;
}

export function generateProfilePhotoKey(
  userId: string,
  extension: string
): string {
  return `${PUBLIC_MEDIA_KEY_PREFIX}${userId}/${uuidv4()}.${extension}`;
}

export function generateIdDocumentKey(
  userId: string,
  extension: string
): string {
  return `${PRIVATE_ID_KEY_PREFIX}${userId}/${uuidv4()}.${extension}`;
}

export function generateLivenessVideoKey(
  userId: string,
  extension: string
): string {
  return `${PRIVATE_LIVENESS_KEY_PREFIX}${userId}/${uuidv4()}.${extension}`;
}

export function getProfilePhotoUploadTarget(
  userId: string,
  extension: string
): StorageUploadTarget {
  const key = generateProfilePhotoKey(userId, extension);
  assertPublicMediaObjectKey(key);
  return {
    client: "public",
    bucket: getPublicMediaBucketName(),
    key,
    credentialSource: "S3_ACCESS_KEY_ID",
    generatesPublicCdnUrl: true,
  };
}

export function getIdDocumentUploadTarget(
  userId: string,
  extension: string
): StorageUploadTarget {
  const config = getPrivateVerificationStorageConfig();
  const key = generateIdDocumentKey(userId, extension);
  assertOwnedPrivateVerificationKey(userId, key, "id");
  return {
    client: "private",
    bucket: config.bucketName,
    key,
    credentialSource: config.credentialSource,
    generatesPublicCdnUrl: false,
  };
}

export function getLivenessVideoUploadTarget(
  userId: string,
  extension: string
): StorageUploadTarget {
  const config = getPrivateVerificationStorageConfig();
  const key = generateLivenessVideoKey(userId, extension);
  assertOwnedPrivateVerificationKey(userId, key, "liveness");
  return {
    client: "private",
    bucket: config.bucketName,
    key,
    credentialSource: config.credentialSource,
    generatesPublicCdnUrl: false,
  };
}
