import { eq } from "drizzle-orm";
import { db, recruiterProfiles } from "@/lib/db";
import { analyzeProfilePhoto } from "@/lib/moderation/photo-provider";
import type { PhotoAnalysisResult } from "@/lib/moderation/photo-policy";
import {
  isPersistablePublicMediaUrl,
  PublicMediaConfigError,
} from "@/lib/media/public-url";
import {
  assertOwnedPhotoStagingKey,
  assertOwnedPublicProfilePhotoKey,
} from "@/lib/storage/keys";
import { PrivateStorageConfigError } from "@/lib/storage/config";
import {
  assertUploadedStagedProfileImageWithinLimit,
  createModerationStagingSignedGet,
  deleteFile,
  deleteStagedProfilePhoto,
  generatePresignedProfilePhotoStagingUrl,
  getStagedProfilePhotoBuffer,
  promoteStagedProfilePhotoToPublic,
} from "@/lib/storage/s3";
import {
  VENUE_LOGO_ERRORS,
  decideVenueLogoPublication,
  imageTypesMatch,
  sniffAllowedImageType,
} from "@/lib/media/venue-logo";

export interface VenueLogoRecord {
  profileId: string;
  logoKey: string | null;
}

export interface VenueLogoStore {
  getLogo(userId: string): Promise<VenueLogoRecord | null>;
  setLogo(
    profileId: string,
    logo: { logoKey: string | null; logoUrl: string | null }
  ): Promise<void>;
}

export interface VenueLogoStorage {
  presignStaging(
    userId: string,
    contentType: string,
    contentLength?: number
  ): Promise<{ uploadUrl: string; key: string }>;
  assertStagedWithinLimit(
    key: string
  ): Promise<{ contentLength: number; contentType?: string }>;
  readStaged(key: string): Promise<Buffer>;
  signedStagingGet(key: string): Promise<string>;
  deleteStaged(key: string): Promise<void>;
  promote(
    userId: string,
    stagingKey: string
  ): Promise<{ photoKey: string; photoUrl: string }>;
  deletePublic(key: string): Promise<void>;
}

export type VenueLogoFailure = {
  ok: false;
  status: 400 | 404 | 503;
  message: string;
};

export type VenueLogoPresignResult =
  | { ok: true; uploadUrl: string; key: string }
  | VenueLogoFailure;

export type VenueLogoConfirmResult =
  | { ok: true; logoKey: string; logoUrl: string }
  | VenueLogoFailure;

export type VenueLogoClearResult = { ok: true } | VenueLogoFailure;

const defaultStore: VenueLogoStore = {
  async getLogo(userId: string): Promise<VenueLogoRecord | null> {
    const [profile] = await db
      .select({
        profileId: recruiterProfiles.id,
        logoKey: recruiterProfiles.logoKey,
      })
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.userId, userId))
      .limit(1);

    return profile ?? null;
  },
  async setLogo(profileId, logo): Promise<void> {
    await db
      .update(recruiterProfiles)
      .set({
        logoKey: logo.logoKey,
        logoUrl: logo.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(recruiterProfiles.id, profileId));
  },
};

const defaultStorage: VenueLogoStorage = {
  presignStaging: generatePresignedProfilePhotoStagingUrl,
  assertStagedWithinLimit: assertUploadedStagedProfileImageWithinLimit,
  readStaged: getStagedProfilePhotoBuffer,
  signedStagingGet: (key) => createModerationStagingSignedGet(key, 300),
  deleteStaged: deleteStagedProfilePhoto,
  promote: promoteStagedProfilePhotoToPublic,
  deletePublic: deleteFile,
};

function isStorageConfigError(error: unknown): boolean {
  return (
    error instanceof PrivateStorageConfigError ||
    error instanceof PublicMediaConfigError
  );
}

function mapStagingError(error: unknown): VenueLogoFailure | null {
  if (!(error instanceof Error)) return null;
  if (error.message === "UPLOAD_TOO_LARGE") {
    return { ok: false, status: 400, message: VENUE_LOGO_ERRORS.tooLarge };
  }
  if (error.message === "UPLOAD_INVALID_TYPE") {
    return { ok: false, status: 400, message: VENUE_LOGO_ERRORS.invalidType };
  }
  if (
    error.message === "UPLOAD_NOT_VERIFIED" ||
    error.message === "PHOTO_STAGING_INVALID_KEY" ||
    error.message === "PHOTO_STAGING_KEY_NOT_OWNED" ||
    error.message === "PUBLIC_MEDIA_FORBIDDEN_KEY"
  ) {
    return { ok: false, status: 400, message: VENUE_LOGO_ERRORS.uploadFailed };
  }
  return null;
}

async function discardStaged(
  storage: VenueLogoStorage,
  key: string
): Promise<void> {
  try {
    await storage.deleteStaged(key);
  } catch (error) {
    if (isStorageConfigError(error)) throw error;
  }
}

async function discardPublic(
  storage: VenueLogoStorage,
  userId: string,
  key: string | null
): Promise<void> {
  if (!key) return;
  try {
    assertOwnedPublicProfilePhotoKey(userId, key);
    await storage.deletePublic(key);
  } catch (error) {
    if (isStorageConfigError(error)) throw error;
  }
}

export async function presignVenueLogo(
  userId: string,
  contentType: string,
  contentLength: number,
  deps: { store?: VenueLogoStore; storage?: VenueLogoStorage } = {}
): Promise<VenueLogoPresignResult> {
  const store = deps.store ?? defaultStore;
  const storage = deps.storage ?? defaultStorage;
  const record = await store.getLogo(userId);
  if (!record) {
    return {
      ok: false,
      status: 404,
      message: VENUE_LOGO_ERRORS.profileMissing,
    };
  }

  const presigned = await storage.presignStaging(
    userId,
    contentType,
    contentLength
  );
  return { ok: true, uploadUrl: presigned.uploadUrl, key: presigned.key };
}

export async function confirmVenueLogo(
  userId: string,
  stagingKey: string,
  deps: {
    store?: VenueLogoStore;
    storage?: VenueLogoStorage;
    analyze?: (imageUrl: string) => Promise<PhotoAnalysisResult>;
  } = {}
): Promise<VenueLogoConfirmResult> {
  const store = deps.store ?? defaultStore;
  const storage = deps.storage ?? defaultStorage;
  const analyze = deps.analyze ?? analyzeProfilePhoto;

  try {
    assertOwnedPhotoStagingKey(userId, stagingKey);
  } catch (error) {
    const mapped = mapStagingError(error);
    if (mapped) return mapped;
    throw error;
  }

  const record = await store.getLogo(userId);
  if (!record) {
    return {
      ok: false,
      status: 404,
      message: VENUE_LOGO_ERRORS.profileMissing,
    };
  }

  let metadata: { contentLength: number; contentType?: string };
  try {
    metadata = await storage.assertStagedWithinLimit(stagingKey);
  } catch (error) {
    if (isStorageConfigError(error)) throw error;
    const mapped = mapStagingError(error);
    if (mapped) return mapped;
    throw error;
  }

  const bytes = await storage.readStaged(stagingKey);
  const sniffed = sniffAllowedImageType(bytes);
  if (!sniffed || !imageTypesMatch(metadata.contentType, sniffed)) {
    await discardStaged(storage, stagingKey);
    return { ok: false, status: 400, message: VENUE_LOGO_ERRORS.invalidType };
  }

  let analysis: PhotoAnalysisResult;
  try {
    const signedUrl = await storage.signedStagingGet(stagingKey);
    analysis = await analyze(signedUrl);
  } catch (error) {
    if (isStorageConfigError(error)) throw error;
    await discardStaged(storage, stagingKey);
    return {
      ok: false,
      status: 503,
      message: VENUE_LOGO_ERRORS.serviceUnavailable,
    };
  }

  const publication = decideVenueLogoPublication(analysis);
  if (!publication.publish) {
    await discardStaged(storage, stagingKey);
    return { ok: false, status: 400, message: publication.message };
  }

  let promoted: { photoKey: string; photoUrl: string };
  try {
    promoted = await storage.promote(userId, stagingKey);
  } catch (error) {
    if (isStorageConfigError(error)) throw error;
    await discardStaged(storage, stagingKey);
    const mapped = mapStagingError(error);
    if (mapped) return mapped;
    throw error;
  }

  try {
    assertOwnedPublicProfilePhotoKey(userId, promoted.photoKey);
  } catch {
    await discardPublic(storage, userId, promoted.photoKey);
    return {
      ok: false,
      status: 400,
      message: VENUE_LOGO_ERRORS.uploadFailed,
    };
  }

  if (!isPersistablePublicMediaUrl(promoted.photoUrl)) {
    await discardPublic(storage, userId, promoted.photoKey);
    return {
      ok: false,
      status: 503,
      message: VENUE_LOGO_ERRORS.serviceUnavailable,
    };
  }

  await store.setLogo(record.profileId, {
    logoKey: promoted.photoKey,
    logoUrl: promoted.photoUrl,
  });

  if (record.logoKey && record.logoKey !== promoted.photoKey) {
    await discardPublic(storage, userId, record.logoKey);
  }

  return {
    ok: true,
    logoKey: promoted.photoKey,
    logoUrl: promoted.photoUrl,
  };
}

export async function clearVenueLogo(
  userId: string,
  deps: { store?: VenueLogoStore; storage?: VenueLogoStorage } = {}
): Promise<VenueLogoClearResult> {
  const store = deps.store ?? defaultStore;
  const storage = deps.storage ?? defaultStorage;
  const record = await store.getLogo(userId);
  if (!record) {
    return {
      ok: false,
      status: 404,
      message: VENUE_LOGO_ERRORS.profileMissing,
    };
  }

  await store.setLogo(record.profileId, { logoKey: null, logoUrl: null });
  await discardPublic(storage, userId, record.logoKey);
  return { ok: true };
}
