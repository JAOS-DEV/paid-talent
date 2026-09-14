export const LIVENESS_UPLOAD_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type LivenessUploadContentType =
  (typeof LIVENESS_UPLOAD_CONTENT_TYPES)[number];

export const LIVENESS_RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/quicktime",
] as const;

export const LIVE_RECORDING_MAX_SECONDS = 12;
export const LIVE_RECORDING_MIN_SECONDS = 3;
export const LIVE_RECORDING_COUNTDOWN_SECONDS = 3;

export const LIVE_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "user" },
  audio: true,
};

export const UNSUPPORTED_LIVE_RECORDING_MESSAGE =
  "Identity verification requires a live camera recording in a compatible browser. Please use Safari or Chrome on this device. Uploading a saved video is not allowed.";

export type LiveRecordingErrorCode =
  | "permission_denied"
  | "device_unavailable"
  | "unsupported"
  | "cancelled"
  | "recording_failed"
  | "incompatible_output";

export function defaultMediaRecorderIsTypeSupported(mime: string): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function" &&
    MediaRecorder.isTypeSupported(mime)
  );
}

export function pickSupportedLivenessMimeType(
  isTypeSupported: (mime: string) => boolean = defaultMediaRecorderIsTypeSupported
): string | null {
  for (const candidate of LIVENESS_RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function isLiveRecordingApiAvailable(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

export function isLiveRecordingSupported(
  isTypeSupported: (mime: string) => boolean = defaultMediaRecorderIsTypeSupported
): boolean {
  if (!isLiveRecordingApiAvailable()) {
    return false;
  }

  return (
    pickSupportedLivenessMimeType(isTypeSupported) !== null ||
    typeof MediaRecorder !== "undefined"
  );
}

export function toAllowedLivenessContentType(
  mimeType: string | null | undefined
): LivenessUploadContentType | null {
  if (!mimeType) {
    return null;
  }

  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (
    LIVENESS_UPLOAD_CONTENT_TYPES.includes(base as LivenessUploadContentType)
  ) {
    return base as LivenessUploadContentType;
  }

  return null;
}

export function resolveLivenessUploadContentType(
  blobType: string | null | undefined,
  recorderMimeType: string | null | undefined
): LivenessUploadContentType | null {
  return (
    toAllowedLivenessContentType(blobType) ||
    toAllowedLivenessContentType(recorderMimeType)
  );
}

export function classifyGetUserMediaError(
  error: unknown
): LiveRecordingErrorCode {
  const name =
    error instanceof DOMException
      ? error.name
      : error instanceof Error
        ? error.name
        : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "PermissionDismissedError"
  ) {
    return "permission_denied";
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "AbortError"
  ) {
    return "device_unavailable";
  }

  if (name === "SecurityError" || name === "TypeError") {
    return "unsupported";
  }

  return "recording_failed";
}

export function messageForLiveRecordingError(
  code: LiveRecordingErrorCode
): string {
  switch (code) {
    case "permission_denied":
      return "Camera or microphone permission was denied. Live recording is required to verify your identity.";
    case "device_unavailable":
      return "No camera is available, or it is already in use. Please check your device and try again.";
    case "unsupported":
      return UNSUPPORTED_LIVE_RECORDING_MESSAGE;
    case "cancelled":
      return "Recording was cancelled. You can open the camera again when you are ready.";
    case "incompatible_output":
      return "This browser recorded a video type we cannot accept. Please use Safari or Chrome on this device.";
    case "recording_failed":
      return "Live recording failed. Please try again. Uploading a saved video is not allowed.";
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
