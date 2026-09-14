import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  PROFILE_PHOTO_ALLOWED_TYPES,
  PROFILE_PHOTO_MAX_BYTES,
} from "@/lib/media/profile-photo";
import { buildPublicMediaUrl } from "@/lib/media/public-url";
import {
  capPrivateSignedGetExpiry,
  getPrivateVerificationStorageConfig,
  getPublicMediaBucketName,
  getPublicMediaStorageConfig,
} from "@/lib/storage/config";
import {
  assertOwnedPhotoStagingKey,
  assertOwnedPrivateVerificationKey,
  assertPhotoStagingObjectKey,
  assertPrivateVerificationObjectKey,
  assertPublicMediaObjectKey,
} from "@/lib/storage/keys";
import { assertAdminCanAccessPrivateVerificationMedia } from "@/lib/storage/private-access";
import {
  generateIdDocumentKey,
  generateLivenessVideoKey,
  generateProfilePhotoKey,
  generateProfilePhotoStagingKey,
  getIdDocumentUploadTarget,
  getLivenessVideoUploadTarget,
  getProfilePhotoStagingUploadTarget,
  getProfilePhotoUploadTarget,
} from "@/lib/storage/targets";

function createPublicMediaClient(): S3Client {
  const config = getPublicMediaStorageConfig();
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
}

function createPrivateVerificationClient(): S3Client {
  const config = getPrivateVerificationStorageConfig();
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
}

const ALLOWED_IMAGE_TYPES: string[] = [...PROFILE_PHOTO_ALLOWED_TYPES];
const MAX_FILE_SIZE = PROFILE_PHOTO_MAX_BYTES;

export interface UploadResult {
  key: string;
  url: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export interface PresignedPrivateUploadResult {
  uploadUrl: string;
  key: string;
}

export async function generatePresignedProfilePhotoStagingUrl(
  userId: string,
  contentType: string,
  contentLength?: number
): Promise<PresignedPrivateUploadResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
    );
  }

  if (contentLength !== undefined && contentLength > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  const extension = contentType.split("/")[1];
  const target = getProfilePhotoStagingUploadTarget(userId, extension);
  const privateClient = createPrivateVerificationClient();

  const command = new PutObjectCommand({
    Bucket: target.bucket,
    Key: target.key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  });

  const uploadUrl = await getSignedUrl(privateClient, command, {
    expiresIn: 3600,
  });

  return { uploadUrl, key: target.key };
}

export async function getStagedProfilePhotoMetadata(
  key: string
): Promise<{ contentLength?: number; contentType?: string } | null> {
  assertPhotoStagingObjectKey(key);
  try {
    const privateClient = createPrivateVerificationClient();
    const response = await privateClient.send(
      new HeadObjectCommand({
        Bucket: getPrivateVerificationStorageConfig().bucketName,
        Key: key,
      })
    );

    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  } catch {
    return null;
  }
}

export async function deleteStagedProfilePhoto(key: string): Promise<void> {
  assertPhotoStagingObjectKey(key);
  const privateClient = createPrivateVerificationClient();
  const command = new DeleteObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  await privateClient.send(command);
}

export async function assertUploadedStagedProfileImageWithinLimit(
  key: string
): Promise<{ contentLength: number; contentType?: string }> {
  assertPhotoStagingObjectKey(key);
  const metadata = await getStagedProfilePhotoMetadata(key);

  if (!metadata || metadata.contentLength == null) {
    throw new Error("UPLOAD_NOT_VERIFIED");
  }

  if (metadata.contentLength > MAX_FILE_SIZE) {
    await deleteStagedProfilePhoto(key);
    throw new Error("UPLOAD_TOO_LARGE");
  }

  if (
    metadata.contentType &&
    !ALLOWED_IMAGE_TYPES.includes(metadata.contentType)
  ) {
    await deleteStagedProfilePhoto(key);
    throw new Error("UPLOAD_INVALID_TYPE");
  }

  return {
    contentLength: metadata.contentLength,
    contentType: metadata.contentType,
  };
}

export async function getStagedProfilePhotoBuffer(key: string): Promise<Buffer> {
  assertPhotoStagingObjectKey(key);
  const privateClient = createPrivateVerificationClient();
  const command = new GetObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  const response = await privateClient.send(command);
  const chunks: Uint8Array[] = [];

  if (response.Body) {
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

export async function createModerationStagingSignedGet(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  assertPhotoStagingObjectKey(key);
  const privateClient = createPrivateVerificationClient();
  const command = new GetObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  return getSignedUrl(privateClient, command, {
    expiresIn: capPrivateSignedGetExpiry(expiresIn),
  });
}

export async function getSignedPhotoStagingUrlForAdmin(
  adminEmail: string | null | undefined,
  key: string,
  expiresIn: number = 300
): Promise<string> {
  assertAdminCanAccessPrivateVerificationMedia(adminEmail);
  assertPhotoStagingObjectKey(key);
  return createModerationStagingSignedGet(key, expiresIn);
}

export async function promoteStagedProfilePhotoToPublic(
  userId: string,
  stagingKey: string
): Promise<{ photoKey: string; photoUrl: string }> {
  assertOwnedPhotoStagingKey(userId, stagingKey);

  const metadata = await assertUploadedStagedProfileImageWithinLimit(stagingKey);
  const contentType = metadata.contentType || "image/jpeg";
  const extension = contentType.split("/")[1] || "jpeg";
  const publicTarget = getProfilePhotoUploadTarget(userId, extension);
  const publicUrl = getPublicUrl(publicTarget.key);
  const body = await getStagedProfilePhotoBuffer(stagingKey);

  await uploadFile(body, publicTarget.key, contentType);

  try {
    await deleteStagedProfilePhoto(stagingKey);
  } catch {
    console.warn("[Media] Could not delete private staging object after promotion");
  }

  return { photoKey: publicTarget.key, photoUrl: publicUrl };
}

export async function generatePresignedUploadUrl(
  userId: string,
  contentType: string,
  contentLength?: number
): Promise<PresignedUploadResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
    );
  }

  if (contentLength !== undefined && contentLength > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  const extension = contentType.split("/")[1];
  const target = getProfilePhotoUploadTarget(userId, extension);
  const publicClient = createPublicMediaClient();

  const command = new PutObjectCommand({
    Bucket: target.bucket,
    Key: target.key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  });

  const uploadUrl = await getSignedUrl(publicClient, command, {
    expiresIn: 3600,
  });

  const publicUrl = getPublicUrl(target.key);

  return { uploadUrl, key: target.key, publicUrl };
}

export async function uploadFile(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  assertPublicMediaObjectKey(key);

  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const publicClient = createPublicMediaClient();
  const command = new PutObjectCommand({
    Bucket: getPublicMediaBucketName(),
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await publicClient.send(command);

  return {
    key,
    url: getPublicUrl(key),
  };
}

export async function deleteFile(key: string): Promise<void> {
  assertPublicMediaObjectKey(key);
  const publicClient = createPublicMediaClient();
  const command = new DeleteObjectCommand({
    Bucket: getPublicMediaBucketName(),
    Key: key,
  });

  await publicClient.send(command);
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  assertPublicMediaObjectKey(key);
  const publicClient = createPublicMediaClient();
  const command = new GetObjectCommand({
    Bucket: getPublicMediaBucketName(),
    Key: key,
  });

  return getSignedUrl(publicClient, command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  assertPublicMediaObjectKey(key);
  return buildPublicMediaUrl(key, {
    cdnUrl: process.env.S3_CDN_URL,
    endpoint: process.env.S3_ENDPOINT,
    bucketName: getPublicMediaBucketName(),
    region: process.env.S3_REGION,
  });
}

export async function getUploadedObjectMetadata(
  key: string
): Promise<{ contentLength?: number; contentType?: string } | null> {
  assertPublicMediaObjectKey(key);
  try {
    const publicClient = createPublicMediaClient();
    const response = await publicClient.send(
      new HeadObjectCommand({
        Bucket: getPublicMediaBucketName(),
        Key: key,
      })
    );

    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  } catch {
    return null;
  }
}

export async function assertUploadedProfileImageWithinLimit(
  key: string
): Promise<{ contentLength: number; contentType?: string }> {
  assertPublicMediaObjectKey(key);
  const metadata = await getUploadedObjectMetadata(key);

  if (!metadata || metadata.contentLength == null) {
    throw new Error("UPLOAD_NOT_VERIFIED");
  }

  if (metadata.contentLength > MAX_FILE_SIZE) {
    await deleteFile(key);
    throw new Error("UPLOAD_TOO_LARGE");
  }

  if (
    metadata.contentType &&
    !ALLOWED_IMAGE_TYPES.includes(metadata.contentType)
  ) {
    await deleteFile(key);
    throw new Error("UPLOAD_INVALID_TYPE");
  }

  return {
    contentLength: metadata.contentLength,
    contentType: metadata.contentType,
  };
}

const ALLOWED_ID_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];
const MAX_ID_DOCUMENT_SIZE = 10 * 1024 * 1024;

export async function generatePresignedIdUploadUrl(
  userId: string,
  contentType: string
): Promise<PresignedPrivateUploadResult> {
  if (!ALLOWED_ID_DOCUMENT_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type for ID document. Allowed: ${ALLOWED_ID_DOCUMENT_TYPES.join(", ")}`
    );
  }

  const extension =
    contentType === "application/pdf" ? "pdf" : contentType.split("/")[1];
  const target = getIdDocumentUploadTarget(userId, extension);
  const privateClient = createPrivateVerificationClient();

  const command = new PutObjectCommand({
    Bucket: target.bucket,
    Key: target.key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(privateClient, command, {
    expiresIn: 3600,
  });

  return { uploadUrl, key: target.key };
}

export async function uploadIdDocument(
  file: Buffer,
  key: string,
  contentType: string
): Promise<{ key: string }> {
  assertPrivateVerificationObjectKey(key, "id");

  if (file.length > MAX_ID_DOCUMENT_SIZE) {
    throw new Error(
      `ID document too large. Maximum size: ${MAX_ID_DOCUMENT_SIZE / 1024 / 1024}MB`
    );
  }

  if (!ALLOWED_ID_DOCUMENT_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type for ID document. Allowed: ${ALLOWED_ID_DOCUMENT_TYPES.join(", ")}`
    );
  }

  const privateClient = createPrivateVerificationClient();
  const command = new PutObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await privateClient.send(command);

  return { key };
}

export async function getSignedIdDocumentUrl(
  adminEmail: string | null | undefined,
  key: string,
  expiresIn: number = 300
): Promise<string> {
  assertAdminCanAccessPrivateVerificationMedia(adminEmail);
  assertPrivateVerificationObjectKey(key, "id");
  const privateClient = createPrivateVerificationClient();
  const command = new GetObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  return getSignedUrl(privateClient, command, {
    expiresIn: capPrivateSignedGetExpiry(expiresIn),
  });
}

export async function deleteIdDocument(key: string): Promise<void> {
  assertPrivateVerificationObjectKey(key, "id");
  const privateClient = createPrivateVerificationClient();
  const command = new DeleteObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  await privateClient.send(command);
}

async function readPrivateObjectBuffer(key: string): Promise<Buffer> {
  assertPrivateVerificationObjectKey(key);
  const privateClient = createPrivateVerificationClient();
  const command = new GetObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  const response = await privateClient.send(command);
  const chunks: Uint8Array[] = [];

  if (response.Body) {
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

export async function getOwnedIdDocumentBuffer(
  userId: string,
  key: string
): Promise<Buffer> {
  assertOwnedPrivateVerificationKey(userId, key, "id");
  return readPrivateObjectBuffer(key);
}

export async function getIdDocumentBufferForAdmin(
  adminEmail: string | null | undefined,
  key: string
): Promise<Buffer> {
  assertAdminCanAccessPrivateVerificationMedia(adminEmail);
  assertPrivateVerificationObjectKey(key, "id");
  return readPrivateObjectBuffer(key);
}

const ALLOWED_LIVENESS_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const MAX_LIVENESS_VIDEO_SIZE = 50 * 1024 * 1024;

export async function generatePresignedLivenessVideoUploadUrl(
  userId: string,
  contentType: string
): Promise<PresignedPrivateUploadResult> {
  if (!ALLOWED_LIVENESS_VIDEO_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type for liveness video. Allowed: ${ALLOWED_LIVENESS_VIDEO_TYPES.join(", ")}`
    );
  }

  const extensionMap: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  const extension = extensionMap[contentType] || "mp4";
  const target = getLivenessVideoUploadTarget(userId, extension);
  const privateClient = createPrivateVerificationClient();

  const command = new PutObjectCommand({
    Bucket: target.bucket,
    Key: target.key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(privateClient, command, {
    expiresIn: 3600,
  });

  return { uploadUrl, key: target.key };
}

export async function getSignedLivenessVideoUrl(
  adminEmail: string | null | undefined,
  key: string,
  expiresIn: number = 300
): Promise<string> {
  assertAdminCanAccessPrivateVerificationMedia(adminEmail);
  assertPrivateVerificationObjectKey(key, "liveness");
  const privateClient = createPrivateVerificationClient();
  const command = new GetObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  return getSignedUrl(privateClient, command, {
    expiresIn: capPrivateSignedGetExpiry(expiresIn),
  });
}

export async function deleteLivenessVideo(key: string): Promise<void> {
  assertPrivateVerificationObjectKey(key, "liveness");
  const privateClient = createPrivateVerificationClient();
  const command = new DeleteObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  await privateClient.send(command);
}

export async function getOwnedLivenessVideoBuffer(
  userId: string,
  key: string
): Promise<Buffer> {
  assertOwnedPrivateVerificationKey(userId, key, "liveness");
  return readPrivateObjectBuffer(key);
}

export async function getLivenessVideoBufferForAdmin(
  adminEmail: string | null | undefined,
  key: string
): Promise<Buffer> {
  assertAdminCanAccessPrivateVerificationMedia(adminEmail);
  assertPrivateVerificationObjectKey(key, "liveness");
  return readPrivateObjectBuffer(key);
}

export async function getPrivateFileBuffer(key: string): Promise<Buffer> {
  return readPrivateObjectBuffer(key);
}

export async function deletePrivateFile(key: string): Promise<void> {
  assertPrivateVerificationObjectKey(key);
  const privateClient = createPrivateVerificationClient();
  const command = new DeleteObjectCommand({
    Bucket: getPrivateVerificationStorageConfig().bucketName,
    Key: key,
  });

  await privateClient.send(command);
}

const BUCKET_NAME = getPublicMediaBucketName();

export {
  generateProfilePhotoKey,
  generateProfilePhotoStagingKey,
  generateIdDocumentKey,
  generateLivenessVideoKey,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_ID_DOCUMENT_TYPES,
  ALLOWED_LIVENESS_VIDEO_TYPES,
  MAX_FILE_SIZE,
  MAX_ID_DOCUMENT_SIZE,
  MAX_LIVENESS_VIDEO_SIZE,
  BUCKET_NAME,
};
