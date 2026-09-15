import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecruiterInterestCard } from "../RecruiterInterestCard";

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

describe("RecruiterInterestCard mobile layout", () => {
  it("stacks hire actions below worker information instead of sharing one compressed row", () => {
    render(
      <div style={{ width: 390 }}>
        <RecruiterInterestCard
          interest={{
            id: "int-1",
            workerProfileId: "worker-profile-1",
            workerName: "Araya S.",
            workerPhoto: null,
            message: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            hireOutcome: null,
            confirmationRequest: null,
          }}
          onRequestCreated={() => undefined}
        />
      </div>
    );

    const card = screen.getByTestId("interest-card");
    expect(card.querySelector(".md\\:flex-row")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Request hire confirmation" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Profile" })).toBeInTheDocument();
    expect(card.className + card.innerHTML).not.toContain("flex-shrink-0 flex flex-col items-end");
  });
});
