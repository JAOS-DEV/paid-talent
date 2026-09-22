import { applyPhotoPolicy, type PhotoAnalysisResult } from "@/lib/moderation/photo-policy";
import {
  PROFILE_PHOTO_ALLOWED_TYPES,
  PROFILE_PHOTO_ERRORS,
  type ProfilePhotoContentType,
} from "@/lib/media/profile-photo";
import { isPersistablePublicMediaUrl } from "@/lib/media/public-url";

export const VENUE_LOGO_ERRORS = {
  tooLarge: PROFILE_PHOTO_ERRORS.tooLarge,
  heic: PROFILE_PHOTO_ERRORS.heic,
  invalidType: PROFILE_PHOTO_ERRORS.invalidType,
  uploadFailed: "We couldn't upload your logo. Please try again.",
  serviceUnavailable: "Logo upload is temporarily unavailable.",
  rejected: "This image can't be used as a venue logo.",
  profileMissing: "Recruiter profile not found",
} as const;

export const VENUE_LOGO_STATUS = {
  preparing: "Preparing logo…",
  uploading: "Uploading logo…",
  saving: "Saving logo…",
} as const;

/**
 * Venue logos reuse the shared photo analyzer, but publication is lighter
 * than the worker gallery: hard policy rejects are blocked, and everything
 * else goes live without a manual review queue.
 */
export function decideVenueLogoPublication(
  analysis: PhotoAnalysisResult
): { publish: true } | { publish: false; message: string } {
  const decision = applyPhotoPolicy(analysis);
  if (decision.action === "reject") {
    return { publish: false, message: VENUE_LOGO_ERRORS.rejected };
  }
  return { publish: true };
}

export function toPublicVenueLogoUrl(
  url: string | null | undefined
): string | null {
  if (!url || !url.trim()) return null;
  return isPersistablePublicMediaUrl(url) ? url : null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

export function sniffAllowedImageType(
  bytes: Uint8Array
): ProfilePhotoContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function imageTypesMatch(
  declared: string | undefined,
  sniffed: ProfilePhotoContentType
): boolean {
  if (!declared) return true;
  const base = declared.split(";")[0]?.trim().toLowerCase();
  if (!base) return true;
  if (!(PROFILE_PHOTO_ALLOWED_TYPES as readonly string[]).includes(base)) {
    return false;
  }
  return base === sniffed;
}
