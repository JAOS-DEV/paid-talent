import { afterEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_LIVENESS_VIDEO_TYPES } from "@/lib/storage/s3";
import {
  LIVENESS_UPLOAD_CONTENT_TYPES,
  bindRecordedPlaybackElement,
  classifyGetUserMediaError,
  detachLivePreviewElement,
  isLiveRecordingApiAvailable,
  isLiveRecordingSupported,
  messageForLiveRecordingError,
  pickSupportedLivenessMimeType,
  resolveLivenessUploadContentType,
  stopMediaStream,
  toAllowedLivenessContentType,
} from "../liveness-recording";

describe("liveness recording helpers", () => {
  it("keeps recorder output types aligned with private liveness storage", () => {
    expect([...LIVENESS_UPLOAD_CONTENT_TYPES].sort()).toEqual(
      [...ALLOWED_LIVENESS_VIDEO_TYPES].sort()
    );
  });

  it("picks the first MediaRecorder MIME type that isTypeSupported accepts", () => {
    const isTypeSupported = (mime: string): boolean => mime === "video/mp4";
    expect(pickSupportedLivenessMimeType(isTypeSupported)).toBe("video/mp4");
  });

  it("returns null when no candidate MIME type is supported", () => {
    expect(pickSupportedLivenessMimeType(() => false)).toBeNull();
  });

  it("maps codec-qualified blob types to backend-accepted content types", () => {
    expect(toAllowedLivenessContentType("video/webm;codecs=vp8,opus")).toBe(
      "video/webm"
    );
    expect(resolveLivenessUploadContentType("", "video/mp4;codecs=avc1")).toBe(
      "video/mp4"
    );
    expect(toAllowedLivenessContentType("video/avi")).toBeNull();
  });

  it("classifies camera permission denial separately from missing hardware", () => {
    expect(
      classifyGetUserMediaError(new DOMException("denied", "NotAllowedError"))
    ).toBe("permission_denied");
    expect(
      classifyGetUserMediaError(new DOMException("missing", "NotFoundError"))
    ).toBe("device_unavailable");
    expect(
      messageForLiveRecordingError("permission_denied")
    ).toMatch(/permission was denied/i);
    expect(messageForLiveRecordingError("unsupported")).toMatch(
      /saved video is not allowed/i
    );
  });

  it("does not claim live recording is available without getUserMedia and MediaRecorder", () => {
    expect(isLiveRecordingApiAvailable()).toBe(false);
    expect(isLiveRecordingSupported(() => false)).toBe(false);
  });

  it("detaches a live preview srcObject without throwing on double-stop", () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const video = document.createElement("video");
    Object.defineProperty(video, "srcObject", {
      configurable: true,
      writable: true,
      value: stream,
    });
    video.pause = vi.fn();

    detachLivePreviewElement(video);
    expect(video.srcObject).toBeNull();

    stopMediaStream(stream);
    stopMediaStream(stream);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("binds playback to a Blob URL with srcObject cleared and audio unmuted", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "srcObject", {
      configurable: true,
      writable: true,
      value: { id: "live" },
    });
    video.load = vi.fn();
    video.muted = true;

    bindRecordedPlaybackElement(video, "blob:recorded");
    expect(video.srcObject).toBeNull();
    expect(video.muted).toBe(false);
    expect(video.getAttribute("src")).toBe("blob:recorded");
    expect(video.load).toHaveBeenCalled();
  });
});

describe("live recording support detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("requires MediaRecorder even if a MIME candidate would otherwise match", () => {
    const original = globalThis.MediaRecorder;
    // @ts-expect-error -- jsdom has no MediaRecorder
    delete globalThis.MediaRecorder;
    expect(isLiveRecordingSupported(() => true)).toBe(false);
    globalThis.MediaRecorder = original;
  });

  it("treats a working MediaRecorder as supported even when isTypeSupported is empty", () => {
    class FakeRecorder {
      static isTypeSupported(): boolean {
        return false;
      }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn() },
    });
    expect(isLiveRecordingApiAvailable()).toBe(true);
    expect(isLiveRecordingSupported(() => false)).toBe(true);
    vi.unstubAllGlobals();
  });
});
