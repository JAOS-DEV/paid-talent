import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkerRequestCard } from "../WorkerRequestCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} />
  ),
}));

describe("WorkerRequestCard", () => {
  it("shows accept and decline, and keeps report behind more actions", () => {
    render(
      <WorkerRequestCard
        request={{
          id: "req-1",
          status: "pending",
          isPro: true,
          openerText: "Hello from the venue",
          followUpText: null,
          followUpSentAt: null,
          deliveredAt: new Date().toISOString(),
          expiresAt: null,
          createdAt: new Date().toISOString(),
          recruiterFirstName: "Ann",
          venue: {
            id: "v1",
            name: "Night Club",
            logoUrl: null,
            linkUrl: null,
            linkApproved: false,
          },
          openingSummary: "Bartender · Sukhumvit",
          conversationId: null,
        }}
      />
    );

    expect(screen.queryByTestId("verified-pro-badge")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "inbox.more" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "inbox.report" })).not.toBeInTheDocument();
    expect(screen.getByText("inbox.accept")).toBeInTheDocument();
    expect(screen.getByText("inbox.decline")).toBeInTheDocument();
    expect(screen.getByText("inbox.safetyLine")).toBeInTheDocument();
  });
});
