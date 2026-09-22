import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const useSession = vi.fn();
const signOut = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
  signOut: (...args: unknown[]) => signOut(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/lib/i18n/actions", () => ({
  setUserLocale: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
    className?: string;
  }): React.ReactElement => (
    <a href={href} data-prefetch={prefetch === false ? "false" : undefined} className={className}>
      {children}
    </a>
  ),
}));

import { Header } from "../Header";

function sessionFor(role: "worker" | "recruiter", isAdmin: boolean) {
  return {
    data: {
      user: {
        email: isAdmin ? "admin@example.com" : `${role}@example.com`,
        role,
        isAdmin,
        signupPending: false,
      },
    },
    status: "authenticated" as const,
  };
}

describe("Header responsive account navigation", () => {
  beforeEach(() => {
    useSession.mockReset();
    signOut.mockReset();
  });

  it("does not render Admin Dashboard and uses a compact Admin control", () => {
    useSession.mockReturnValue(sessionFor("recruiter", true));
    render(<Header />);

    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
    const admin = screen.getByRole("link", { name: "Admin" });
    expect(admin).toHaveAttribute("href", "/admin");
    expect(admin).toHaveAttribute("data-prefetch", "false");
    expect(admin).toHaveClass("whitespace-nowrap");
  });

  it("hides Dashboard and Sign out behind a hamburger for recruiter-admins", () => {
    useSession.mockReturnValue(sessionFor("recruiter", true));
    render(<Header />);

    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass(
      "hidden",
      "md:inline-flex"
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(document.getElementById("account-mobile-nav")).not.toBeNull();
    expect(
      screen.getAllByRole("link", { name: "Dashboard" }).length
    ).toBeGreaterThan(1);
    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Admin" })).toHaveLength(1);
  });

  it("also uses a mobile menu for worker-admins without duplicating Admin", () => {
    useSession.mockReturnValue(sessionFor("worker", true));
    render(<Header />);

    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = document.getElementById("account-mobile-nav");
    expect(menu).not.toBeNull();
    expect(menu?.querySelector('a[href="/worker/profile"]')).not.toBeNull();
    expect(menu?.querySelector('a[href="/worker/verification"]')).not.toBeNull();
    expect(screen.getAllByRole("link", { name: "Admin" })).toHaveLength(1);
  });

  it("keeps Dashboard and Sign out inline for a normal worker", () => {
    useSession.mockReturnValue(sessionFor("worker", false));
    render(<Header />);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass("inline-flex");
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveClass("inline-flex");
  });

  it("does not show Admin for a normal recruiter", () => {
    useSession.mockReturnValue(sessionFor("recruiter", false));
    render(<Header />);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});
