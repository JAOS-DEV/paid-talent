import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
const updateSession = vi.fn();
const useSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: (): ReturnType<typeof useSession> => useSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: (): { push: typeof push; refresh: typeof refresh } => ({
    push,
    refresh,
  }),
}));

import AgeVerificationPage from "../page";

function renderAuthenticated(): void {
  useSession.mockReturnValue({
    status: "authenticated",
    data: {
      user: {
        id: "user-1",
        role: "worker",
        ageVerified: false,
        email: "new@example.com",
      },
    },
    update: updateSession,
  });
  render(<AgeVerificationPage />);
}

describe("post-auth age-verification page", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    updateSession.mockReset();
    useSession.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("does not redirect to signin when a session exists", () => {
    renderAuthenticated();

    expect(push).not.toHaveBeenCalledWith("/auth/signin");
    expect(
      screen.getByRole("heading", { name: /confirm your date of birth/i })
    ).toBeInTheDocument();
  });

  it("contains a DOB input but no second 20+ checkbox", () => {
    renderAuthenticated();

    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/I confirm I am 20 or older/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify & continue/i })
    ).toBeDisabled();
  });

  it("redirects unauthenticated users to signin", async () => {
    useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
      update: updateSession,
    });
    render(<AgeVerificationPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/auth/signin");
    });
    expect(screen.getByText(/redirecting to sign in/i)).toBeInTheDocument();
  });

  it("rejects DOB under 20 without calling verify-age", async () => {
    renderAuthenticated();
    const fetchMock = vi.mocked(fetch);

    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "2015-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    expect(
      await screen.findByText(/Paid Talent is for adults 20\+/i)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("verified DOB >= 20 updates ageVerified and redirects to onboarding", async () => {
    renderAuthenticated();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        redirectUrl: "/worker/onboarding",
      }),
    } as Response);

    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "1998-04-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/verify-age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth: "1998-04-12" }),
      });
    });
    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith({ ageVerified: true });
    });
    expect(push).toHaveBeenCalledWith("/worker/onboarding");
  });

  it("keeps the mobile-safe date input", () => {
    renderAuthenticated();
    const input = screen.getByLabelText(/date of birth/i);
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveAttribute("max");
  });
});
