import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

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
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
  folder: string = "profiles"
): Promise<PresignedUploadResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
    );
  }

  const extension = contentType.split("/")[1];
  const key = `${folder}/${userId}/${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
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
  const cdnUrl = process.env.S3_CDN_URL;
  if (cdnUrl) {
    return `${cdnUrl}/${key}`;
  }

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    return `${endpoint}/${BUCKET_NAME}/${key}`;
  }

  return `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com/${key}`;
}

export function generateProfilePhotoKey(userId: string, extension: string): string {
  return `profiles/${userId}/${uuidv4()}.${extension}`;
}

export { s3Client, BUCKET_NAME, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE };
