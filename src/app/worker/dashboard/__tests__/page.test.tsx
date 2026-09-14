import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { WorkerProfile } from "@/lib/db/schema";

const replace = vi.fn();
const push = vi.fn();
const useSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }): React.ReactElement => <a href={href}>{children}</a>,
}));

vi.mock("@/components/layout", () => ({
  Header: (): React.ReactElement => <header>Header</header>,
  Footer: (): React.ReactElement => <footer>Footer</footer>,
}));

vi.mock("@/components/verification", () => ({
  VerificationStatusBanner: (): React.ReactElement => <div>Verification</div>,
}));

import WorkerDashboardPage from "../page";

function createMockProfile(
  overrides: Partial<WorkerProfile> = {}
): WorkerProfile {
  return {
    id: "test-id",
    userId: "worker-1",
    photoKey: null,
    photoUrl: null,
    displayName: "",
    location: null,
    area: null,
    description: null,
    bio: null,
    availability: null,
    expectedPayMin: null,
    expectedPayMax: null,
    payCurrency: "USD",
    jobRoles: [],
    experience: null,
    experienceYears: null,
    languages: [],
    lineId: null,
    whatsappNumber: null,
    phoneNumber: null,
    isPublished: false,
    isVerified: false,
    verificationStatus: "unverified",
    idDocumentKey: null,
    livenessVideoKey: null,
    challengeCode: null,
    challengeIssuedAt: null,
    idDocumentSubmittedAt: null,
    verificationReviewedAt: null,
    verificationReviewedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockWorkerSession(): void {
  useSession.mockReturnValue({
    data: {
      user: {
        id: "worker-1",
        name: "Ada",
        role: "worker",
        ageVerified: true,
      },
    },
    status: "authenticated",
  });
}

describe("WorkerDashboardPage", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    useSession.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profile: null }),
      })
    );
  });

  it("lets a 0% complete worker stay on the dashboard", async () => {
    mockWorkerSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profile: createMockProfile() }),
      })
    );

    render(<WorkerDashboardPage />);

    expect(await screen.findByRole("heading", { name: /welcome, ada/i })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith("/worker/onboarding");
    expect(screen.getByRole("button", { name: /complete profile/i })).toBeInTheDocument();
  });

  it("lets a worker below 30% complete stay on the dashboard with Complete Profile", async () => {
    mockWorkerSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: createMockProfile({
            photoUrl: "https://example.com/photo.jpg",
          }),
        }),
      })
    );

    render(<WorkerDashboardPage />);

    expect(await screen.findByText(/14% complete/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith("/worker/onboarding");
    expect(screen.getByRole("button", { name: /complete profile/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /complete profile/i }).closest("a")
    ).toHaveAttribute("href", "/worker/onboarding");
    expect(screen.getByText(/quick tips/i)).toBeInTheDocument();
  });

  it("keeps complete-profile behaviour for a finished profile", async () => {
    mockWorkerSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: createMockProfile({
            photoUrl: "https://example.com/photo.jpg",
            displayName: "Ada",
            jobRoles: ["Bartender"],
            experienceYears: 3,
            languages: ["English"],
            bio: "Experienced bartender",
            location: "Bangkok",
            availability: "Full-time",
          }),
        }),
      })
    );

    render(<WorkerDashboardPage />);

    expect(await screen.findByText(/^complete$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete profile/i })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not allow a recruiter to stay on the worker dashboard", async () => {
    useSession.mockReturnValue({
      data: {
        user: {
          id: "recruiter-1",
          name: "Recruiter",
          role: "recruiter",
          ageVerified: true,
        },
      },
      status: "authenticated",
    });

    render(<WorkerDashboardPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/auth/signin");
    });
    expect(screen.queryByRole("heading", { name: /welcome/i })).not.toBeInTheDocument();
  });

  it("does not render the dashboard for an unauthenticated visitor", () => {
    useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<WorkerDashboardPage />);

    expect(screen.queryByRole("heading", { name: /welcome/i })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
