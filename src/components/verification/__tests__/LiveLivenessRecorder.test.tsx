import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LiveLivenessRecorder } from "../LiveLivenessRecorder";

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
});

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn(), kind: "video" }],
  } as unknown as MediaStream;
}

describe("LiveLivenessRecorder", () => {
  it("does not render a video file picker or capture input", () => {
    render(
      <LiveLivenessRecorder
        stream={fakeStream()}
        challengeDisplayCode="123-456"
        onRecorded={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
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
        stream={fakeStream()}
        challengeDisplayCode="654-321"
        onRecorded={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />
    );

    expect(screen.getByText("Say this code")).toBeInTheDocument();
    expect(screen.getByTestId("live-challenge-code")).toHaveTextContent(
      "654-321"
    );
  });

  it("exposes cancel instead of a gallery fallback", () => {
    const onCancel = vi.fn();
    render(
      <LiveLivenessRecorder
        stream={fakeStream()}
        challengeDisplayCode="123-456"
        onRecorded={vi.fn()}
        onCancel={onCancel}
        onError={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector("input[type='file']")).toBeNull();
  });
});
