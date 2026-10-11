import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WhatHappensNextCard } from "../WhatHappensNextCard";
import type { ProfileCompleteness } from "@/lib/profile";
import { emptyPhotoSlots } from "@/lib/worker-dashboard";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }): React.ReactElement => <a href={href}>{children}</a>,
}));

function incompleteCompleteness(
  progress = 40
): ProfileCompleteness {
  return {
    isComplete: false,
    completedSteps: ["photo", "name"],
    nextStep: "roles",
    progress,
  };
}

function completeCompleteness(): ProfileCompleteness {
  return {
    isComplete: true,
    completedSteps: [
      "photo",
      "name",
      "roles",
      "experience",
      "languages",
      "bio",
      "location",
    ],
    nextStep: null,
    progress: 100,
  };
}

describe("WhatHappensNextCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the card with all four steps by default", () => {
    render(
      <WhatHappensNextCard
        userId="worker-1"
        completeness={incompleteCompleteness(40)}
        photoSlots={emptyPhotoSlots()}
        verificationStatus="unverified"
        profile={null}
      />
    );

    expect(screen.getByTestId("what-happens-next-card")).toBeInTheDocument();
    expect(screen.getByText("What happens next")).toBeInTheDocument();
    expect(screen.getByTestId("what-happens-next-step-1")).toHaveTextContent(
      "40%"
    );
    expect(screen.getByTestId("what-happens-next-step-2")).toHaveTextContent(
      "Add up to 5 photos"
    );
    expect(
      screen.getByTestId("what-happens-next-verification-status")
    ).toHaveTextContent("Not verified");
    expect(
      screen.getByTestId("what-happens-next-contact-nudge")
    ).toBeInTheDocument();
  });

  it("dismisses the card and stores dismissal per user", () => {
    render(
      <WhatHappensNextCard
        userId="worker-1"
        completeness={completeCompleteness()}
        photoSlots={emptyPhotoSlots()}
        verificationStatus="pending"
        profile={{ lineId: "alice", whatsappNumber: null, phoneNumber: null }}
      />
    );

    fireEvent.click(screen.getByTestId("what-happens-next-dismiss"));

    expect(screen.queryByTestId("what-happens-next-card")).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem(
        "paid-talent:what-happens-next-dismissed:worker-1"
      )
    ).toBe("1");
  });

  it("does not share dismissal across accounts", () => {
    window.localStorage.setItem(
      "paid-talent:what-happens-next-dismissed:worker-1",
      "1"
    );

    render(
      <WhatHappensNextCard
        userId="worker-2"
        completeness={incompleteCompleteness()}
        photoSlots={emptyPhotoSlots()}
        verificationStatus="verified"
        profile={null}
      />
    );

    expect(screen.getByTestId("what-happens-next-card")).toBeInTheDocument();
  });

  it("stays hidden when already dismissed for that user", () => {
    window.localStorage.setItem(
      "paid-talent:what-happens-next-dismissed:worker-1",
      "1"
    );

    render(
      <WhatHappensNextCard
        userId="worker-1"
        completeness={incompleteCompleteness()}
        photoSlots={emptyPhotoSlots()}
        verificationStatus="unverified"
        profile={null}
      />
    );

    expect(screen.queryByTestId("what-happens-next-card")).not.toBeInTheDocument();
  });

  it("hides the contact nudge when a contact method exists", () => {
    render(
      <WhatHappensNextCard
        userId="worker-1"
        completeness={completeCompleteness()}
        photoSlots={emptyPhotoSlots()}
        verificationStatus="verified"
        profile={{
          lineId: null,
          whatsappNumber: "+66111111111",
          phoneNumber: null,
        }}
      />
    );

    expect(
      screen.queryByTestId("what-happens-next-contact-nudge")
    ).not.toBeInTheDocument();
    expect(screen.getByText("View interests")).toBeInTheDocument();
  });
});
