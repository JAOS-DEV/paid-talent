import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountVisibilityStrip } from "../AccountVisibilityStrip";

describe("AccountVisibilityStrip", () => {
  it("renders a muted lock-labelled account email strip", () => {
    render(
      <AccountVisibilityStrip
        label="Your account · only visible to you"
        email="worker@example.com"
      />
    );

    const strip = screen.getByTestId("account-visibility-strip");
    expect(strip).toHaveTextContent("Your account · only visible to you");
    expect(strip).toHaveTextContent("worker@example.com");
    expect(strip.querySelector("svg")).not.toBeNull();
  });
});
