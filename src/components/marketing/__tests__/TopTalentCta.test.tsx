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

function mockRecruiterFetches(input: {
  billingAccessMode: "enforced" | "open_access";
  isVerified: boolean;
}): void {
  vi.mocked(fetch).mockImplementation(async (inputUrl) => {
    const url = String(inputUrl);
    if (url.includes("/api/stripe/status")) {
      return {
        ok: true,
        json: async () => ({ billingAccessMode: input.billingAccessMode }),
      } as Response;
    }
    if (url.includes("/api/recruiter/access")) {
      return {
        ok: true,
        json: async () => ({ isVerified: input.isVerified }),
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

describe("TopTalentCta", () => {
  beforeEach(() => {
    useSession.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("links verified recruiters to upgrade when billing is enforced", async () => {
    useSession.mockReturnValue(recruiterSession());
    mockRecruiterFetches({ billingAccessMode: "enforced", isVerified: true });

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", {
      name: "View Verified Pro pricing",
    });
    expect(link).toHaveAttribute("href", "/recruiter/upgrade");
    expect(
      screen.queryByText(
        /Premium Top Talent messaging and limits are currently free for all venues/i
      )
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/stripe/status");
    expect(fetch).toHaveBeenCalledWith("/api/recruiter/access");
  });

  it("links unverified recruiters to verification instead of checkout", async () => {
    useSession.mockReturnValue(recruiterSession());
    mockRecruiterFetches({ billingAccessMode: "enforced", isVerified: false });

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", { name: "Verify to upgrade" });
    expect(link).toHaveAttribute("href", "/recruiter/verification");
    expect(
      screen.queryByRole("link", { name: "View Verified Pro pricing" })
    ).not.toBeInTheDocument();
  });

  it("uses open-access label, note, and search link when mode is open_access", async () => {
    useSession.mockReturnValue(recruiterSession());
    mockRecruiterFetches({ billingAccessMode: "open_access", isVerified: false });

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", { name: "Free during beta" });
    expect(link).toHaveAttribute("href", "/recruiter/search");
    expect(
      screen.getByText(
        "Premium Top Talent messaging and limits are currently free for all venues while we're in beta. Contact details remain private."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View Verified Pro pricing" })
    ).not.toBeInTheDocument();
  });

  it("keeps anonymous users on recruiter signup without calling stripe status", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<TopTalentCta />);

    const link = await screen.findByRole("link", {
      name: "Sign up as a venue",
    });
    expect(link).toHaveAttribute("href", "/auth/age-gate?role=recruiter");
    await waitFor(() => {
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
