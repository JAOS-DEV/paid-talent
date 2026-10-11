import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminLivenessVideoPlayer } from "../AdminLivenessVideoPlayer";

describe("AdminLivenessVideoPlayer", () => {
  it("uses a typed source element for playback", () => {
    const { container } = render(
      <AdminLivenessVideoPlayer
        url="https://signed.example/live.webm"
        contentType="video/webm"
      />
    );

    const source = container.querySelector("source");
    expect(source).not.toBeNull();
    expect(source).toHaveAttribute("src", "https://signed.example/live.webm");
    expect(source).toHaveAttribute("type", "video/webm");

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(
      screen.getByRole("link", { name: /download video/i })
    ).toHaveAttribute("href", "https://signed.example/live.webm");
  });

  it("shows a download fallback when the browser cannot decode the video", () => {
    const { container } = render(
      <AdminLivenessVideoPlayer
        url="https://signed.example/live.mp4"
        contentType="video/mp4"
      />
    );

    fireEvent.error(container.querySelector("video") as HTMLVideoElement);

    expect(
      screen.getByText(/cannot play the liveness video/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /download video/i })
    ).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
  });

  it("surfaces download guidance for QuickTime/MOV before a decode error", () => {
    render(
      <AdminLivenessVideoPlayer
        url="https://signed.example/live.mov"
        contentType="video/quicktime"
      />
    );

    expect(
      screen.getByText(/may not play in desktop Chrome\/Firefox/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /download video/i })
    ).toBeInTheDocument();
  });
});
