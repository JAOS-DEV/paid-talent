import {
  PROFILE_PHOTO_ERRORS,
  inspectProfilePhotoFile,
  mapUploadNetworkError,
  readSafeApiError,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import { prepareProfileImage } from "@/lib/media/resize-profile-image";

export interface ProfilePhotoUploadResult {
  key: string;
  publicUrl: string;
}

export interface ProfilePhotoUploadDeps {
  fetch?: typeof fetch;
  prepareImage?: (file: File) => Promise<File>;
  onStage?: (stage: ProfilePhotoUploadStage) => void;
}

/**
 * Safari throws "Can only call Window.fetch on instances of Window" when
 * `window.fetch` is extracted (`{ fetch }`) and invoked as a free function.
 * Always call it with a Window/`globalThis` receiver.
 */
export function callProfilePhotoFetch(
  fetchImpl: typeof fetch | undefined,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (fetchImpl) {
    return Reflect.apply(fetchImpl, globalThis, [
      input,
      init,
    ]) as Promise<Response>;
  }
  return globalThis.fetch(input, init);
}

interface PresignResponse {
  uploadUrl?: string;
  key?: string;
  publicUrl?: string;
}

export class ProfilePhotoUploadError extends Error {
  readonly stage: "validate" | "compress" | "presign" | "storage" | "confirm";

  constructor(
    stage: ProfilePhotoUploadError["stage"],
    message: string
  ) {
    super(message);
    this.name = "ProfilePhotoUploadError";
    this.stage = stage;
  }
}

export async function uploadProfilePhoto(
  file: File,
  deps: ProfilePhotoUploadDeps = {}
): Promise<ProfilePhotoUploadResult> {
  const inspected = inspectProfilePhotoFile(file);
  if (!inspected.ok) {
    throw new ProfilePhotoUploadError("validate", inspected.message);
  }

  deps.onStage?.("preparing");

  const prepareImage = deps.prepareImage ?? prepareProfileImage;
  let prepared: File;
  try {
    prepared = await prepareImage(file);
  } catch {
    throw new ProfilePhotoUploadError(
      "compress",
      PROFILE_PHOTO_ERRORS.uploadFailed
    );
  }

  const preparedInspection = inspectProfilePhotoFile(prepared);
  if (!preparedInspection.ok) {
    throw new ProfilePhotoUploadError("validate", preparedInspection.message);
  }

  let presignedRes: Response;
  try {
    presignedRes = await callProfilePhotoFetch(deps.fetch, "/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: preparedInspection.contentType,
        folder: "profiles",
        contentLength: prepared.size,
      }),
    });
  } catch (error) {
    throw new ProfilePhotoUploadError(
      "presign",
      mapUploadNetworkError(error, PROFILE_PHOTO_ERRORS.serviceUnavailable)
    );
  }

  if (!presignedRes.ok) {
    const fallback =
      presignedRes.status >= 500
        ? PROFILE_PHOTO_ERRORS.serviceUnavailable
        : PROFILE_PHOTO_ERRORS.uploadFailed;
    throw new ProfilePhotoUploadError(
      "presign",
      await readSafeApiError(presignedRes, fallback)
    );
  }

  let presignBody: PresignResponse;
  try {
    presignBody = (await presignedRes.json()) as PresignResponse;
  } catch {
    throw new ProfilePhotoUploadError(
      "presign",
      PROFILE_PHOTO_ERRORS.serviceUnavailable
    );
  }

  const { uploadUrl, key, publicUrl } = presignBody;
  if (!uploadUrl || !key || !publicUrl) {
    throw new ProfilePhotoUploadError(
      "presign",
      PROFILE_PHOTO_ERRORS.serviceUnavailable
    );
  }

  deps.onStage?.("uploading");

  let uploadRes: Response;
  try {
    uploadRes = await callProfilePhotoFetch(deps.fetch, uploadUrl, {
      method: "PUT",
      body: prepared,
      headers: {
        "Content-Type": preparedInspection.contentType,
      },
    });
  } catch (error) {
    throw new ProfilePhotoUploadError(
      "storage",
      mapUploadNetworkError(error, PROFILE_PHOTO_ERRORS.uploadFailed)
    );
  }

  if (!uploadRes.ok) {
    throw new ProfilePhotoUploadError(
      "storage",
      PROFILE_PHOTO_ERRORS.uploadFailed
    );
  }

  deps.onStage?.("saving");

  let confirmRes: Response;
  try {
    confirmRes = await callProfilePhotoFetch(deps.fetch, "/api/media/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, publicUrl }),
    });
  } catch (error) {
    throw new ProfilePhotoUploadError(
      "confirm",
      mapUploadNetworkError(error, PROFILE_PHOTO_ERRORS.uploadFailed)
    );
  }

  if (!confirmRes.ok) {
    throw new ProfilePhotoUploadError(
      "confirm",
      await readSafeApiError(confirmRes, PROFILE_PHOTO_ERRORS.uploadFailed)
    );
  }

  return { key, publicUrl };
}
