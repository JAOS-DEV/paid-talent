import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveLivenessRecorder } from "../LiveLivenessRecorder";
import {
  LIVE_RECORDING_COUNTDOWN_SECONDS,
  LIVE_RECORDING_MIN_SECONDS,
} from "@/lib/verification/liveness-recording";

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get() {
      return (this as HTMLMediaElement & { _srcObject?: MediaStream | null })
        ._srcObject ?? null;
    },
    set(value: MediaStream | null) {
      (this as HTMLMediaElement & { _srcObject?: MediaStream | null })._srcObject =
        value;
    },
  });
});

class FakeMediaRecorder {
  static isTypeSupported(mime: string): boolean {
    return mime.includes("webm") || mime.includes("mp4");
  }

  state = "inactive";
  mimeType = "video/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["recorded-bytes"], { type: "video/webm" }),
    } as BlobEvent);
    this.onstop?.();
  }
}

function createStream(id: string): {
  stream: MediaStream;
  stopVideo: ReturnType<typeof vi.fn>;
  stopAudio: ReturnType<typeof vi.fn>;
} {
  const stopVideo = vi.fn();
  const stopAudio = vi.fn();
  const stream = {
    id,
    getTracks: () => [
      { kind: "video", stop: stopVideo, readyState: "live" },
      { kind: "audio", stop: stopAudio, readyState: "live" },
    ],
  } as unknown as MediaStream;
  return { stream, stopVideo, stopAudio };
}

describe("LiveLivenessRecorder", () => {
  const onRecorded = vi.fn();
  const onCancel = vi.fn();
  const onError = vi.fn();
  const onReacquireCamera = vi.fn();

  beforeEach(() => {
    onRecorded.mockReset();
    onCancel.mockReset();
    onError.mockReset();
    onReacquireCamera.mockReset();
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    URL.createObjectURL = vi.fn(() => "blob:recorded-liveness");
    URL.revokeObjectURL = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not render a video file picker or capture input", () => {
    render(
      <LiveLivenessRecorder
        stream={createStream("s1").stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    expect(screen.getByTestId("liveness-recorder")).toBeInTheDocument();
    expect(screen.getByTestId("live-challenge-code")).toHaveTextContent(
      "123-456"
    );
    expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument();
    expect(document.querySelector("input[type='file']")).toBeNull();
    expect(document.querySelector("input[accept*='video']")).toBeNull();
    expect(document.querySelector("input[capture]")).toBeNull();
  });

  it("keeps the challenge code visible while previewing the live camera", () => {
    render(
      <LiveLivenessRecorder
        stream={createStream("s1").stream}
        challengeDisplayCode="654-321"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    expect(screen.getByText("Say this code")).toBeInTheDocument();
    expect(screen.getByTestId("live-challenge-code")).toHaveTextContent(
      "654-321"
    );
  });

  it("attaches the live MediaStream to the preview video", () => {
    const { stream } = createStream("live-1");
    render(
      <LiveLivenessRecorder
        stream={stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    const preview = screen.getByTestId(
      "liveness-live-preview"
    ) as HTMLVideoElement;
    expect(preview.srcObject).toBe(stream);
    expect(preview.muted).toBe(true);
    expect(screen.queryByTestId("liveness-playback")).not.toBeInTheDocument();
  });

  it("exposes cancel instead of a gallery fallback", () => {
    render(
      <LiveLivenessRecorder
        stream={createStream("s1").stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector("input[type='file']")).toBeNull();
  });

  async function recordUntilReview(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: /start recording/i }));
    await act(async () => {
      vi.advanceTimersByTime(LIVE_RECORDING_COUNTDOWN_SECONDS * 1000);
    });
    await act(async () => {
      vi.advanceTimersByTime(LIVE_RECORDING_MIN_SECONDS * 1000);
    });
    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
  }

  it("detaches srcObject, stops live tracks, and plays the Blob URL unmuted on review", async () => {
    const { stream, stopVideo, stopAudio } = createStream("live-1");
    render(
      <LiveLivenessRecorder
        stream={stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    const preview = screen.getByTestId(
      "liveness-live-preview"
    ) as HTMLVideoElement;
    expect(preview.srcObject).toBe(stream);

    await recordUntilReview();

    expect(stopVideo).toHaveBeenCalled();
    expect(stopAudio).toHaveBeenCalled();
    expect(screen.queryByTestId("liveness-live-preview")).not.toBeInTheDocument();

    const playback = screen.getByTestId("liveness-playback") as HTMLVideoElement;
    expect(playback.srcObject).toBeNull();
    expect(playback).not.toHaveAttribute("muted");
    expect(playback.muted).toBe(false);
    expect(playback.getAttribute("src")).toBe("blob:recorded-liveness");
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    expect(document.querySelector("input[type='file']")).toBeNull();
  });

  it("sends the recorded Blob when Use this video is pressed", async () => {
    render(
      <LiveLivenessRecorder
        stream={createStream("live-1").stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    await recordUntilReview();
    fireEvent.click(screen.getByRole("button", { name: /use this video/i }));

    expect(onRecorded).toHaveBeenCalledTimes(1);
    const [blob, contentType] = onRecorded.mock.calls[0] as [
      Blob,
      string,
    ];
    expect(blob).toBeInstanceOf(Blob);
    expect(contentType).toBe("video/webm");
  });

  it("requests a new camera instead of reusing stopped tracks on Record again", async () => {
    const first = createStream("live-1");
    const { rerender } = render(
      <LiveLivenessRecorder
        stream={first.stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    await recordUntilReview();
    fireEvent.click(screen.getByRole("button", { name: /record again/i }));
    expect(onReacquireCamera).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:recorded-liveness");
    expect(screen.queryByTestId("liveness-playback")).not.toBeInTheDocument();
    expect(screen.getByTestId("liveness-reacquiring")).toBeInTheDocument();
    expect(screen.queryByTestId("liveness-live-preview")).not.toBeInTheDocument();

    const second = createStream("live-2");
    rerender(
      <LiveLivenessRecorder
        stream={second.stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    const preview = screen.getByTestId(
      "liveness-live-preview"
    ) as HTMLVideoElement;
    expect(preview.srcObject).toBe(second.stream);
    expect(preview.srcObject).not.toBe(first.stream);
    expect(screen.queryByTestId("liveness-playback")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start recording/i })
    ).toBeInTheDocument();
  });

  it("revokes the object URL on unmount", async () => {
    const { unmount } = render(
      <LiveLivenessRecorder
        stream={createStream("live-1").stream}
        challengeDisplayCode="123-456"
        onRecorded={onRecorded}
        onCancel={onCancel}
        onError={onError}
        onReacquireCamera={onReacquireCamera}
      />
    );

    await recordUntilReview();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:recorded-liveness");
  });
});
