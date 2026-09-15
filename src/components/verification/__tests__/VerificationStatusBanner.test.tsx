import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VerificationStatusBanner } from "../VerificationStatusBanner";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }): React.ReactElement => <a href={href}>{children}</a>,
}));

describe("VerificationStatusBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lets a verified live worker dismiss the large success banner", () => {
    render(
      <VerificationStatusBanner
        status="verified"
        isPublished
        hasApprovedPrimaryPhoto
        userId="worker-1"
      />
    );

    expect(screen.getByTestId("verified-live-banner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss verified banner/i }));
    expect(screen.getByTestId("verified-live-compact")).toHaveTextContent("Verified");
    expect(screen.getByText("Profile live")).toBeInTheDocument();
    expect(
      window.localStorage.getItem("paid-talent:verified-banner-dismissed:worker-1")
    ).toBe("1");
  });

  it("does not share dismissal across accounts", () => {
    window.localStorage.setItem(
      "paid-talent:verified-banner-dismissed:worker-1",
      "1"
    );

    render(
      <VerificationStatusBanner
        status="verified"
        isPublished
        hasApprovedPrimaryPhoto
        userId="worker-2"
      />
    );

    expect(screen.getByTestId("verified-live-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("verified-live-compact")).not.toBeInTheDocument();
  });

  it("cannot hide pending or rejected states with a stored success dismissal", () => {
    window.localStorage.setItem(
      "paid-talent:verified-banner-dismissed:worker-1",
      "1"
    );

    const { rerender } = render(
      <VerificationStatusBanner
        status="pending"
        isPublished={false}
        userId="worker-1"
      />
    );
    expect(screen.getByText("Verification Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss verified banner/i })).not.toBeInTheDocument();

    rerender(
      <VerificationStatusBanner
        status="rejected"
        isPublished={false}
        userId="worker-1"
      />
    );
    expect(screen.getByText("Verification Rejected")).toBeInTheDocument();

    rerender(
      <VerificationStatusBanner
        status="verified"
        isPublished={false}
        hasApprovedPrimaryPhoto
        userId="worker-1"
      />
    );
    expect(screen.getByText("Profile Not Published")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss verified banner/i })).not.toBeInTheDocument();
  });

  it("shows photo awaiting approval when identity is verified first", () => {
    render(
      <VerificationStatusBanner
        status="verified"
        isPublished
        hasApprovedPrimaryPhoto={false}
        userId="worker-1"
      />
    );

    expect(
      screen.getByText("Identity verified — profile photo awaiting approval.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("verified-live-banner")).not.toBeInTheDocument();
  });
});
