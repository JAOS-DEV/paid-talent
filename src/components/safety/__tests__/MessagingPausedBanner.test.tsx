import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessagingPausedBanner } from "../MessagingPausedBanner";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("MessagingPausedBanner", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<MessagingPausedBanner visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders paused message when visible", () => {
    render(<MessagingPausedBanner visible />);
    expect(screen.getByTestId("messaging-paused-banner")).toHaveTextContent(
      "messagingPaused"
    );
  });
});
