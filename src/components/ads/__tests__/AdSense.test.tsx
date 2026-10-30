import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdSense } from "../AdSense";

describe("AdSense", () => {
  it("hides the placeholder unless a real ad client is configured", () => {
    const { container } = render(
      <AdSense adSlot="landing-page-bottom" adFormat="horizontal" />
    );
    expect(screen.queryByText("Ad Placeholder")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
