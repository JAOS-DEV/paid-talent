import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkerInterestCard } from "../WorkerInterestCard";
import { toWorkerInterestCardModel } from "../model";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }): React.ReactElement => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const longBlurb =
  "Sky Bar hires experienced floor staff for weekend nights across the rooftop and the lounge. Guests expect a calm, polished service style.";

describe("WorkerInterestCard", () => {
  it("shows the venue, a two-line blurb, and interest actions without a messages tab", () => {
    render(
      <WorkerInterestCard
        interest={toWorkerInterestCardModel({
          interestId: "int-1",
          venueName: "Sky Bar",
          displayName: "Recruiter",
          area: "Sukhumvit",
          subArea: "Soi 11",
          blurb: longBlurb,
          logoUrl: "https://example.com/logo.png",
          openingRole: "Bartender",
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "Sky Bar" })).toBeInTheDocument();
    expect(screen.getByText("Sukhumvit · Soi 11")).toBeInTheDocument();
    expect(screen.getByText(longBlurb)).toHaveClass("line-clamp-2");
    expect(screen.getByText("Interested in you")).toBeInTheDocument();
    expect(screen.getByText("Bartender")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sky Bar logo" })).toHaveAttribute(
      "src",
      "https://example.com/logo.png"
    );

    const openings = screen.getByRole("link", { name: "View openings" });
    const venue = screen.getByRole("link", { name: "View venue" });
    expect(openings).toHaveAttribute("href", "/worker/interests/int-1/openings");
    expect(venue).toHaveAttribute("href", "/worker/interests/int-1/venue");
    expect(openings.className).toContain("min-h-11");
    expect(openings.className).toContain("bg-primary-500");
    expect(venue.className).toContain("min-h-11");
    expect(openings.compareDocumentPosition(venue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByRole("tab", { name: /messages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /message/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/chat/i)).not.toBeInTheDocument();
  });

  it("falls back to an initial when the venue has no logo", () => {
    render(
      <WorkerInterestCard
        interest={toWorkerInterestCardModel({
          interestId: "int-2",
          venueName: null,
          displayName: "Ada Venue",
          area: null,
          blurb: null,
          logoUrl: null,
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "Ada Venue" })).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
