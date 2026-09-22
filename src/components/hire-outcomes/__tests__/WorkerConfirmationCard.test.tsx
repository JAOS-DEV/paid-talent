import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkerConfirmationCard } from "../WorkerConfirmationCard";

describe("WorkerConfirmationCard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true }),
      })
    );
  });

  it("renders a pending hire card and confirms via the worker endpoint", async () => {
    const onResponded = vi.fn();

    render(
      <WorkerConfirmationCard
        requestId="11111111-1111-1111-1111-111111111111"
        venueName="Sky Bar"
        openingContext="Bartender — Central Pattaya"
        requestedStatus="hired"
        requestedAt="2026-03-01T00:00:00.000Z"
        onResponded={onResponded}
      />
    );

    expect(screen.getByText("Action required")).toBeInTheDocument();
    expect(
      screen.getByText("Sky Bar says they have hired you.")
    ).toBeInTheDocument();
    expect(screen.getByText("Bartender — Central Pattaya")).toBeInTheDocument();
    expect(screen.queryByAltText("Sky Bar logo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm hired" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/worker/hire-confirmations/11111111-1111-1111-1111-111111111111/confirm",
        { method: "POST" }
      );
      expect(onResponded).toHaveBeenCalledWith("confirm");
    });
  });

  it("shows the venue logo when the recruiter has one", () => {
    render(
      <WorkerConfirmationCard
        requestId="11111111-1111-1111-1111-111111111111"
        venueName="Sky Bar"
        logoUrl="https://cdn.example/venues/sky.png"
        requestedStatus="hired"
      />
    );

    expect(screen.getByAltText("Sky Bar logo")).toHaveAttribute(
      "src",
      "https://cdn.example/venues/sky.png"
    );
  });

  it("renders a pending start card and rejects via the worker endpoint", async () => {
    const onResponded = vi.fn();

    render(
      <WorkerConfirmationCard
        requestId="22222222-2222-2222-2222-222222222222"
        venueName="Sky Bar"
        requestedStatus="started"
        onResponded={onResponded}
      />
    );

    expect(
      screen.getByText("Sky Bar says you have started working with them.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Not yet / This isn't correct" })
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/worker/hire-confirmations/22222222-2222-2222-2222-222222222222/reject",
        { method: "POST" }
      );
      expect(onResponded).toHaveBeenCalledWith("reject");
    });
  });
});
