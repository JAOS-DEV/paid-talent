import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

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
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
    className?: string;
    "aria-label"?: string;
  }): React.ReactElement => (
    <a
      href={href}
      data-prefetch={prefetch === false ? "false" : undefined}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    className,
  }: {
    alt: string;
    src: string;
    className?: string;
  }): React.ReactElement => <img alt={alt} src={src} className={className} />,
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

describe("Header chrome", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    useSession.mockReset();
    signOut.mockReset();
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ unreadCount: 0, notifications: [] }), {
        status: 200,
      })
    ) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("keeps a compact Admin control without an Admin Dashboard label", () => {
    useSession.mockReturnValue(sessionFor("recruiter", true));
    const { container } = render(<Header />);

    expect(container.querySelector("header")).toHaveClass("h-14", "overflow-x-hidden");
    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/recruiter/search"
    );
    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute(
      "href",
      "/recruiter/billing"
    );

    const admin = screen.getByRole("link", { name: "Admin" });
    expect(admin).toHaveAttribute("href", "/admin");
    expect(admin).toHaveAttribute("data-prefetch", "false");
    expect(admin).toHaveClass("h-8", "whitespace-nowrap");

    const logo = screen.getByRole("link", { name: "Paid Talent" });
    expect(logo).toHaveAttribute("href", "/recruiter/dashboard");
    const images = logo.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/brand/paid-talent-mark.svg");
    expect(images[0]).toHaveClass("h-8", "w-8", "min-[380px]:hidden");
    expect(images[1]).toHaveAttribute("src", "/brand/paid-talent-logo.svg");
    expect(images[1]).toHaveClass("hidden", "h-7", "max-w-[180px]", "min-[380px]:block");
    expect(screen.getByRole("button", { name: "Language" })).toHaveClass("h-8");
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveClass("h-8");
  });

  it("does not duplicate Admin for a worker-admin", () => {
    useSession.mockReturnValue(sessionFor("worker", true));
    render(<Header />);

    expect(screen.getAllByRole("link", { name: "Admin" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Paid Talent" })).toHaveAttribute(
      "href",
      "/worker/dashboard"
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/worker/profile"
    );
    expect(screen.queryByRole("link", { name: "Verification" })).not.toBeInTheDocument();
  });

  it("shows Logo, globe, and Sign out for a normal worker", () => {
    useSession.mockReturnValue(sessionFor("worker", false));
    render(<Header />);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/worker/dashboard"
    );
    expect(screen.getByRole("link", { name: "Requests" })).toHaveAttribute(
      "href",
      "/worker/requests"
    );
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/worker/messages"
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/worker/profile"
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings/notifications"
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Interests" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paid Talent" })).toHaveAttribute(
      "href",
      "/worker/dashboard"
    );
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveClass("h-8");
  });

  it("points a recruiter logo at the recruiter dashboard", () => {
    useSession.mockReturnValue(sessionFor("recruiter", false));
    render(<Header />);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Search Talent" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/recruiter/search"
    );
    expect(screen.getByRole("link", { name: "Openings" })).toHaveAttribute(
      "href",
      "/recruiter/openings"
    );
    expect(screen.getByRole("link", { name: "Venues" })).toHaveAttribute(
      "href",
      "/recruiter/venues"
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/recruiter/profile"
    );
    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute(
      "href",
      "/recruiter/billing"
    );
    expect(screen.getByRole("link", { name: "Paid Talent" })).toHaveAttribute(
      "href",
      "/recruiter/dashboard"
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("shows Logo, globe, Login, and Get Started for guests", () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<Header />);

    expect(screen.getByRole("link", { name: "Paid Talent" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/signin"
    );
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
      "href",
      "/auth/role-select"
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass("h-8");
    expect(screen.getByRole("button", { name: "Get Started" })).toHaveClass("h-8");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("sends a pending signup logo to role selection", () => {
    useSession.mockReturnValue({
      data: {
        user: {
          email: "new@example.com",
          signupPending: true,
        },
      },
      status: "authenticated" as const,
    });
    render(<Header />);

    expect(screen.getByRole("link", { name: "Paid Talent" })).toHaveAttribute(
      "href",
      "/auth/role-select"
    );
    expect(screen.getByRole("link", { name: "Finish signup" })).toHaveAttribute(
      "href",
      "/auth/role-select"
    );
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
