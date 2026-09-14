export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_DIMENSION = 1920;
export const PROFILE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export const PROFILE_PHOTO_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type ProfilePhotoContentType =
  (typeof PROFILE_PHOTO_ALLOWED_TYPES)[number];

const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSIONS = [".heic", ".heif"];

export const PROFILE_PHOTO_ERRORS = {
  tooLarge: "This photo is too large. Maximum size is 10 MB.",
  heic: "HEIC photos aren't supported yet. Please choose a JPG, PNG or WebP image.",
  invalidType: "Please choose a JPG, PNG or WebP image.",
  uploadFailed: "We couldn't upload your photo. Please try again.",
  serviceUnavailable: "Photo upload service is temporarily unavailable.",
} as const;

export type ProfilePhotoInspectResult =
  | { ok: true; contentType: ProfilePhotoContentType }
  | { ok: false; message: string };

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function isHeicFile(file: { name: string; type: string }): boolean {
  const type = file.type.toLowerCase();
  if (HEIC_TYPES.has(type)) {
    return true;
  }
  return HEIC_EXTENSIONS.includes(fileExtension(file.name));
}

function resolveContentType(
  file: { name: string; type: string }
): ProfilePhotoContentType | null {
  const type = file.type.toLowerCase();
  if (
    (PROFILE_PHOTO_ALLOWED_TYPES as readonly string[]).includes(type)
  ) {
    return type as ProfilePhotoContentType;
  }

  const extension = fileExtension(file.name);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return null;
}

export function inspectProfilePhotoFile(file: {
  name: string;
  type: string;
  size: number;
}): ProfilePhotoInspectResult {
  const contentType = resolveContentType(file);

  // Safari may convert HEIC → JPEG while keeping a .heic filename.
  // Trust an allowed MIME type from the browser first.
  if (!contentType && isHeicFile(file)) {
    return { ok: false, message: PROFILE_PHOTO_ERRORS.heic };
  }

  if (!contentType) {
    return { ok: false, message: PROFILE_PHOTO_ERRORS.invalidType };
  }

  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return { ok: false, message: PROFILE_PHOTO_ERRORS.tooLarge };
  }

  return { ok: true, contentType };
}

export function parseSafeApiError(
  payload: unknown,
  fallback: string
): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }
  return fallback;
}

export async function readSafeApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload: unknown = await response.json();
    return parseSafeApiError(payload, fallback);
  } catch {
    return fallback;
  }
}

export function isBrowserNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    message === "Load failed" ||
    message === "Failed to fetch" ||
    message === "NetworkError when attempting to fetch resource."
  );
}

export function mapUploadNetworkError(error: unknown, fallback: string): string {
  if (isBrowserNetworkError(error)) {
    return fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim();
    if (message === "Load failed" || message === "Failed to fetch") {
      return fallback;
    }
    return message;
  }
  return fallback;
}
