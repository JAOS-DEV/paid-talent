import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HireOutcomeActions } from "../HireOutcomeActions";

describe("HireOutcomeActions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true }),
      })
    );
  });

  it("requests hire confirmation without treating the worker as hired", async () => {
    const onRequestCreated = vi.fn();

    render(
      <HireOutcomeActions
        interestId="33333333-3333-3333-3333-333333333333"
        currentStatus="interested"
        onRequestCreated={onRequestCreated}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Request hire confirmation" })
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/recruiter/interests/request-hire",
        expect.objectContaining({ method: "POST" })
      );
      expect(onRequestCreated).toHaveBeenCalledWith("hired");
    });
  });

  it("shows awaiting confirmation instead of Hired while pending", () => {
    render(
      <HireOutcomeActions
        interestId="33333333-3333-3333-3333-333333333333"
        currentStatus="interested"
        confirmationRequest={{
          requestedStatus: "hired",
          requestStatus: "pending",
        }}
      />
    );

    expect(screen.getByText("Awaiting talent confirmation")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request hire confirmation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Hired")).not.toBeInTheDocument();
  });

  it("offers start confirmation only after confirmed hired", () => {
    render(
      <HireOutcomeActions
        interestId="33333333-3333-3333-3333-333333333333"
        currentStatus="hired"
      />
    );

    expect(
      screen.getByRole("button", { name: "Request start confirmation" })
    ).toBeInTheDocument();
  });
});
