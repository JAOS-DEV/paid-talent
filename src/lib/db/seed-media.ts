import fs from "node:fs";
import {
  getPublicMediaStorageConfig,
  getPrivateVerificationStorageConfig,
  PrivateStorageConfigError,
} from "@/lib/storage/config";
import {
  getPublicUrl,
  headPrivateVerificationObject,
  headPublicObject,
  uploadFile,
  uploadIdDocument,
  uploadLivenessVideo,
} from "@/lib/storage/s3";
import {
  assertOwnedPrivateVerificationKey,
  assertOwnedPublicProfilePhotoKey,
} from "@/lib/storage/keys";
import { computeFileSha256 } from "@/lib/verification";

export interface SeedMediaUploadResult {
  key: string;
  url: string | null;
  sha256: string;
  uploaded: boolean;
}

export interface SeedMediaStats {
  uploaded: number;
  skipped: number;
  skipReason: string | null;
}

const stats: SeedMediaStats = {
  uploaded: 0,
  skipped: 0,
  skipReason: null,
};

export function resetSeedMediaStats(): void {
  stats.uploaded = 0;
  stats.skipped = 0;
  stats.skipReason = null;
}

export function getSeedMediaStats(): SeedMediaStats {
  return { ...stats };
}

export function isSeedPublicStorageConfigured(): boolean {
  const config = getPublicMediaStorageConfig();
  return Boolean(
    config.accessKeyId &&
      config.secretAccessKey &&
      process.env.S3_BUCKET_NAME?.trim()
  );
}

export function isSeedPrivateStorageConfigured(): boolean {
  try {
    getPrivateVerificationStorageConfig();
    return true;
  } catch (error) {
    if (error instanceof PrivateStorageConfigError) return false;
    return false;
  }
}

function markSkipped(reason: string): void {
  stats.skipped += 1;
  stats.skipReason = reason;
}

export async function uploadPublicSeedObject(
  key: string,
  buffer: Buffer,
  contentType: string,
  ownerUserId: string
): Promise<SeedMediaUploadResult> {
  assertOwnedPublicProfilePhotoKey(ownerUserId, key);
  const sha256 = computeFileSha256(buffer);

  if (!isSeedPublicStorageConfigured()) {
    markSkipped("S3 public credentials/bucket missing");
    return { key, url: null, sha256, uploaded: false };
  }

  const result = await uploadFile(buffer, key, contentType);
  stats.uploaded += 1;
  return { key: result.key, url: result.url, sha256, uploaded: true };
}

export async function uploadPrivateIdSeedObject(
  key: string,
  buffer: Buffer,
  contentType: string,
  ownerUserId: string
): Promise<SeedMediaUploadResult> {
  assertOwnedPrivateVerificationKey(ownerUserId, key, "id");
  const sha256 = computeFileSha256(buffer);

  if (!isSeedPrivateStorageConfigured()) {
    markSkipped("S3 private credentials/bucket missing");
    return { key, url: null, sha256, uploaded: false };
  }

  await uploadIdDocument(buffer, key, contentType);
  stats.uploaded += 1;
  return { key, url: null, sha256, uploaded: true };
}

export async function uploadPrivateLivenessSeedObject(
  key: string,
  buffer: Buffer,
  contentType: string,
  ownerUserId: string
): Promise<SeedMediaUploadResult> {
  assertOwnedPrivateVerificationKey(ownerUserId, key, "liveness");
  const sha256 = computeFileSha256(buffer);

  if (!isSeedPrivateStorageConfigured()) {
    markSkipped("S3 private credentials/bucket missing");
    return { key, url: null, sha256, uploaded: false };
  }

  await uploadLivenessVideo(buffer, key, contentType);
  stats.uploaded += 1;
  return { key, url: null, sha256, uploaded: true };
}

export function readSeedFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

export function publicUrlOrPlaceholder(key: string, uploadedUrl: string | null): string {
  if (uploadedUrl) return uploadedUrl;
  try {
    return getPublicUrl(key);
  } catch {
    return `https://cdn.example.local/${key}`;
  }
}

export async function assertSeedObjectsExist(
  keys: Array<{ key: string; bucket: "public" | "private" }>
): Promise<string[]> {
  const missing: string[] = [];
  for (const item of keys) {
    const result =
      item.bucket === "public"
        ? await headPublicObject(item.key)
        : await headPrivateVerificationObject(item.key);
    if (!result.exists) missing.push(`${item.bucket}:${item.key}`);
  }
  return missing;
}

export function printSeedMediaSummary(): void {
  const reason = stats.skipReason ? ` / skipped: ${stats.skipReason}` : "";
  console.log(`\n📷 media uploaded: ${stats.uploaded}${reason}`);
}

/** Stable seed venue links that must pass parseVenueLink. */
export const SEED_VENUE_LINK_FIXTURES = [
  "https://maps.app.goo.gl/PaidTalentSeed01",
  "https://www.google.com/maps/place/Seed+Rooftop+Bar,+Sukhumvit+Soi+11,+Bangkok",
  "https://www.facebook.com/paidtalent.seed.neonclub",
  "https://www.instagram.com/paidtalent.seed.speakeasy",
  "https://www.facebook.com/paidtalent.seed.smallbarco",
  "https://www.facebook.com/paidtalent.seed.teaserbrowse",
  "https://www.facebook.com/paidtalent.seed.reviewqueue",
  "https://www.instagram.com/paidtalent.seed.resubmit",
  "https://maps.app.goo.gl/PaidTalentStaffHQ",
  "https://www.facebook.com/paidtalent.seed.passvenue",
  "https://www.facebook.com/paidtalent.seed.newrecruiter",
] as const;
