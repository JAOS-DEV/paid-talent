import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const useSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
}));

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

import { TopTalentCta } from "../TopTalentCta";

function recruiterSession() {
  return {
    data: {
      user: {
        email: "recruiter@example.com",
        role: "recruiter" as const,
        signupPending: false,
      },
    },
    status: "authenticated" as const,
  };
}

describe("TopTalentCta", () => {
  beforeEach(() => {
    useSession.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ billingAccessMode: "enforced" }),
      })
    );
  });

  it("links signed-in recruiters to upgrade when billing is enforced", async () => {
    useSession.mockReturnValue(recruiterSession());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ billingAccessMode: "enforced" }),
    } as Response);

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", {
      name: "Upgrade for Top Talent",
    });
    expect(link).toHaveAttribute("href", "/recruiter/upgrade");
    expect(
      screen.queryByText(
        /Premium Top Talent messaging and limits are currently free for all recruiters/i
      )
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/stripe/status");
  });

  it("uses open-access label, note, and search link when mode is open_access", async () => {
    useSession.mockReturnValue(recruiterSession());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ billingAccessMode: "open_access" }),
    } as Response);

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", { name: "Free during beta" });
    expect(link).toHaveAttribute("href", "/recruiter/search");
    expect(
      screen.getByText(
        "Premium Top Talent messaging and limits are currently free for all recruiters while we're in beta. Contact details remain private."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Upgrade for Top Talent" })
    ).not.toBeInTheDocument();
  });

  it("keeps anonymous users on recruiter signup without calling stripe status", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", {
      name: "Sign up as a recruiter",
    });
    expect(link).toHaveAttribute("href", "/auth/age-gate?role=recruiter");
    await waitFor(() => {
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
