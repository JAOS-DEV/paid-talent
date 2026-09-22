import { isPersistablePublicMediaUrl } from "@/lib/media/public-url";
import {
  inspectProfilePhotoFile,
  mapUploadNetworkError,
  readSafeApiError,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import { prepareProfileImage } from "@/lib/media/resize-profile-image";
import { callProfilePhotoFetch } from "@/lib/media/upload-profile-photo";
import { VENUE_LOGO_ERRORS } from "@/lib/media/venue-logo";

export interface VenueLogoUploadResult {
  logoKey: string;
  logoUrl: string;
}

export interface VenueLogoUploadDeps {
  fetch?: typeof fetch;
  prepareImage?: (file: File) => Promise<File>;
  onStage?: (stage: ProfilePhotoUploadStage) => void;
}

export class VenueLogoUploadError extends Error {
  readonly stage: "validate" | "compress" | "presign" | "storage" | "confirm";

  constructor(stage: VenueLogoUploadError["stage"], message: string) {
    super(message);
    this.name = "VenueLogoUploadError";
    this.stage = stage;
  }
}

interface PresignResponse {
  uploadUrl?: string;
  key?: string;
}

interface ConfirmResponse {
  success?: boolean;
  logoKey?: string;
  logoUrl?: string;
}

export async function uploadVenueLogo(
  file: File,
  deps: VenueLogoUploadDeps = {}
): Promise<VenueLogoUploadResult> {
  const inspected = inspectProfilePhotoFile(file);
  if (!inspected.ok) {
    throw new VenueLogoUploadError("validate", inspected.message);
  }

  deps.onStage?.("preparing");

  const prepareImage = deps.prepareImage ?? prepareProfileImage;
  let prepared: File;
  try {
    prepared = await prepareImage(file);
  } catch {
    throw new VenueLogoUploadError("compress", VENUE_LOGO_ERRORS.uploadFailed);
  }

  const preparedInspection = inspectProfilePhotoFile(prepared);
  if (!preparedInspection.ok) {
    throw new VenueLogoUploadError("validate", preparedInspection.message);
  }

  let presignedRes: Response;
  try {
    presignedRes = await callProfilePhotoFetch(deps.fetch, "/api/recruiter/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: preparedInspection.contentType,
        folder: "profiles",
        contentLength: prepared.size,
      }),
    });
  } catch (error) {
    throw new VenueLogoUploadError(
      "presign",
      mapUploadNetworkError(error, VENUE_LOGO_ERRORS.serviceUnavailable)
    );
  }

  if (!presignedRes.ok) {
    const fallback =
      presignedRes.status >= 500
        ? VENUE_LOGO_ERRORS.serviceUnavailable
        : VENUE_LOGO_ERRORS.uploadFailed;
    throw new VenueLogoUploadError(
      "presign",
      await readSafeApiError(presignedRes, fallback)
    );
  }

  let presignBody: PresignResponse;
  try {
    presignBody = (await presignedRes.json()) as PresignResponse;
  } catch {
    throw new VenueLogoUploadError(
      "presign",
      VENUE_LOGO_ERRORS.serviceUnavailable
    );
  }

  const { uploadUrl, key } = presignBody;
  if (!uploadUrl || !key) {
    throw new VenueLogoUploadError(
      "presign",
      VENUE_LOGO_ERRORS.serviceUnavailable
    );
  }

  deps.onStage?.("uploading");

  let uploadRes: Response;
  try {
    uploadRes = await callProfilePhotoFetch(deps.fetch, uploadUrl, {
      method: "PUT",
      body: prepared,
      headers: { "Content-Type": preparedInspection.contentType },
    });
  } catch (error) {
    throw new VenueLogoUploadError(
      "storage",
      mapUploadNetworkError(error, VENUE_LOGO_ERRORS.uploadFailed)
    );
  }

  if (!uploadRes.ok) {
    throw new VenueLogoUploadError("storage", VENUE_LOGO_ERRORS.uploadFailed);
  }

  deps.onStage?.("saving");

  let confirmRes: Response;
  try {
    confirmRes = await callProfilePhotoFetch(deps.fetch, "/api/recruiter/logo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  } catch (error) {
    throw new VenueLogoUploadError(
      "confirm",
      mapUploadNetworkError(error, VENUE_LOGO_ERRORS.uploadFailed)
    );
  }

  if (!confirmRes.ok) {
    throw new VenueLogoUploadError(
      "confirm",
      await readSafeApiError(confirmRes, VENUE_LOGO_ERRORS.uploadFailed)
    );
  }

  let confirmBody: ConfirmResponse;
  try {
    confirmBody = (await confirmRes.json()) as ConfirmResponse;
  } catch {
    throw new VenueLogoUploadError("confirm", VENUE_LOGO_ERRORS.uploadFailed);
  }

  if (
    !confirmBody.logoKey ||
    !confirmBody.logoUrl ||
    !isPersistablePublicMediaUrl(confirmBody.logoUrl)
  ) {
    throw new VenueLogoUploadError("confirm", VENUE_LOGO_ERRORS.uploadFailed);
  }

  return { logoKey: confirmBody.logoKey, logoUrl: confirmBody.logoUrl };
}

export async function clearVenueLogo(
  deps: Pick<VenueLogoUploadDeps, "fetch"> = {}
): Promise<void> {
  let response: Response;
  try {
    response = await callProfilePhotoFetch(deps.fetch, "/api/recruiter/logo", {
      method: "DELETE",
    });
  } catch (error) {
    throw new VenueLogoUploadError(
      "confirm",
      mapUploadNetworkError(error, VENUE_LOGO_ERRORS.uploadFailed)
    );
  }

  if (!response.ok) {
    throw new VenueLogoUploadError(
      "confirm",
      await readSafeApiError(response, VENUE_LOGO_ERRORS.uploadFailed)
    );
  }
}

export function venueLogoFailureMessage(error: unknown): string {
  if (error instanceof VenueLogoUploadError && error.message.trim()) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return VENUE_LOGO_ERRORS.uploadFailed;
}
