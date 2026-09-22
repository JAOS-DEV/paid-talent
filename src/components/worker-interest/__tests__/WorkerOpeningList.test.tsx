import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
import { EMPTY_STATE_COPY } from "@/lib/interests/copy";
import type { OpeningTag } from "@/lib/interests/context";
import { VenuePublicView } from "../VenuePublicView";
import { VenueUnavailable } from "../VenueUnavailable";
import { WorkerOpeningList } from "../WorkerOpeningList";

function opening(overrides: Partial<OpeningTag> = {}): OpeningTag {
  return {
    openingId: "55555555-5555-4555-8555-555555555555",
    role: "Bartender",
    area: "Sukhumvit",
    payMin: 1500,
    payMax: null,
    payCurrency: "THB",
    payPeriod: "night",
    ...overrides,
  };
}

describe("worker venue openings display", () => {
  it("always shows pay as symbol, amount, and period", () => {
    render(
      <WorkerOpeningList
        openings={[
          opening(),
          opening({
            openingId: "55555555-5555-4555-8555-555555555556",
            role: "Host",
            payMin: 20,
            payCurrency: "USD",
            payPeriod: "hour",
          }),
          opening({
            openingId: "55555555-5555-4555-8555-555555555557",
            role: "Runner",
            payMin: 800,
            payCurrency: "EUR",
            payPeriod: "shift",
          }),
        ]}
      />
    );

    expect(screen.getByText("฿1,500 / night")).toBeInTheDocument();
    expect(screen.getByText("$20 / hour")).toBeInTheDocument();
    expect(screen.getByText("€800 / shift")).toBeInTheDocument();
    expect(screen.queryByText(/paywall|upgrade|subscribe/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("opening-pay")).toHaveLength(3);
  });

  it("uses the locked empty copy when the venue has no published openings", () => {
    render(<WorkerOpeningList openings={[]} />);
    expect(
      screen.getByText(EMPTY_STATE_COPY.workerNoOpenings)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("opening-pay")).not.toBeInTheDocument();
  });

  it("uses the locked copy when the venue profile is gone", () => {
    render(<VenueUnavailable />);
    expect(
      screen.getByText(EMPTY_STATE_COPY.workerVenueUnavailable)
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View openings" })).not.toBeInTheDocument();
  });

  it("shows the venue blurb and a view-openings action without a messages tab", () => {
    render(
      <VenuePublicView
        interestId="int-1"
        venueName="Sky Bar"
        areaLabel="Sukhumvit"
        blurb="A rooftop bar hiring this month."
        logoUrl={null}
      />
    );

    expect(screen.getByRole("heading", { name: "Sky Bar" })).toBeInTheDocument();
    expect(screen.getByText("Sukhumvit")).toBeInTheDocument();
    const blurb = screen.getByText("A rooftop bar hiring this month.");
    expect(blurb.className).not.toContain("line-clamp-2");
    expect(screen.getByRole("link", { name: "View openings" })).toHaveAttribute(
      "href",
      "/worker/interests/int-1/openings"
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/messages/i)).not.toBeInTheDocument();
  });
});
