import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import {
  PROFILE_PHOTO_ALLOWED_TYPES,
  PROFILE_PHOTO_MAX_BYTES,
} from "@/lib/media/profile-photo";
import { buildPublicMediaUrl } from "@/lib/media/public-url";

const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE),
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "paid-talent-media";
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

export async function generatePresignedUploadUrl(
  userId: string,
  contentType: string,
  folder: string = "profiles",
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
  const key = `${folder}/${userId}/${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  const publicUrl = getPublicUrl(key);

  return { uploadUrl, key, publicUrl };
}

export async function uploadFile(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return {
    key,
    url: getPublicUrl(key),
  };
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  return buildPublicMediaUrl(key, {
    cdnUrl: process.env.S3_CDN_URL,
    endpoint: process.env.S3_ENDPOINT,
    bucketName: BUCKET_NAME,
    region: process.env.S3_REGION,
  });
}

export function generateProfilePhotoKey(userId: string, extension: string): string {
  return `profiles/${userId}/${uuidv4()}.${extension}`;
}

export async function getUploadedObjectMetadata(
  key: string
): Promise<{ contentLength?: number; contentType?: string } | null> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
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

const PRIVATE_BUCKET_NAME =
  process.env.S3_PRIVATE_BUCKET_NAME || "paid-talent-private";
const ALLOWED_ID_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];
const MAX_ID_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB for ID documents

export function generateIdDocumentKey(userId: string, extension: string): string {
  return `verification-docs/${userId}/${uuidv4()}.${extension}`;
}

export async function generatePresignedIdUploadUrl(
  userId: string,
  contentType: string
): Promise<PresignedUploadResult> {
  if (!ALLOWED_ID_DOCUMENT_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type for ID document. Allowed: ${ALLOWED_ID_DOCUMENT_TYPES.join(", ")}`
    );
  }

  const extension =
    contentType === "application/pdf" ? "pdf" : contentType.split("/")[1];
  const key = generateIdDocumentKey(userId, extension);

  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { uploadUrl, key, publicUrl: "" };
}

export async function uploadIdDocument(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
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

  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return {
    key,
    url: "",
  };
}

export async function getSignedIdDocumentUrl(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteIdDocument(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export async function getIdDocumentBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];

  if (response.Body) {
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

const ALLOWED_LIVENESS_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_LIVENESS_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for liveness videos

export function generateLivenessVideoKey(
  userId: string,
  extension: string
): string {
  return `verification-liveness/${userId}/${uuidv4()}.${extension}`;
}

export async function generatePresignedLivenessVideoUploadUrl(
  userId: string,
  contentType: string
): Promise<PresignedUploadResult> {
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
  const key = generateLivenessVideoKey(userId, extension);

  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { uploadUrl, key, publicUrl: "" };
}

export async function getSignedLivenessVideoUrl(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteLivenessVideo(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export async function getLivenessVideoBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];

  if (response.Body) {
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

export async function getPrivateFileBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];

  if (response.Body) {
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

export async function deletePrivateFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export {
  s3Client,
  BUCKET_NAME,
  PRIVATE_BUCKET_NAME,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_ID_DOCUMENT_TYPES,
  ALLOWED_LIVENESS_VIDEO_TYPES,
  MAX_FILE_SIZE,
  MAX_ID_DOCUMENT_SIZE,
  MAX_LIVENESS_VIDEO_SIZE,
};
