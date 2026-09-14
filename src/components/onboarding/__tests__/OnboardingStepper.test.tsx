import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingStepper } from "../OnboardingStepper";
import { ONBOARDING_STEPS } from "@/lib/profile";

function filledSegmentCount(): number {
  return screen
    .getAllByTestId("onboarding-progress-segment")
    .filter((segment) => segment.getAttribute("data-filled") === "true")
    .length;
}

describe("OnboardingStepper progress is onboarding position", () => {
  it("fills exactly 1 of 8 segments on the photo step", () => {
    render(<OnboardingStepper currentStepId="photo" />);

    expect(screen.getByText("Step 1 of 8")).toBeInTheDocument();
    expect(screen.getByText("13%")).toBeInTheDocument();
    expect(screen.getAllByTestId("onboarding-progress-segment")).toHaveLength(
      ONBOARDING_STEPS.length
    );
    expect(filledSegmentCount()).toBe(1);
  });

  it("fills exactly 2 of 8 segments on the name step", () => {
    render(<OnboardingStepper currentStepId="name" />);

    expect(screen.getByText("Step 2 of 8")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(filledSegmentCount()).toBe(2);
  });

  it("does not fill future segments for later journey positions", () => {
    render(<OnboardingStepper currentStepId="photo" />);

    const segments = screen.getAllByTestId("onboarding-progress-segment");
    expect(segments[0]).toHaveAttribute("data-filled", "true");
    segments.slice(1).forEach((segment) => {
      expect(segment).toHaveAttribute("data-filled", "false");
    });
  });

  it("keeps percentage based on the current step through the journey", () => {
    const { rerender } = render(<OnboardingStepper currentStepId="roles" />);

    expect(screen.getByText("Step 3 of 8")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(filledSegmentCount()).toBe(3);

    rerender(<OnboardingStepper currentStepId="contact" />);

    expect(screen.getByText("Step 8 of 8")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(filledSegmentCount()).toBe(8);
  });
});
