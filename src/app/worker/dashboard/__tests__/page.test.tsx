import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/components/hire-outcomes", () => ({
  WorkerConfirmationCard: ({
    venueName,
    requestedStatus,
    onResponded,
  }: {
    venueName: string;
    requestedStatus: string;
    onResponded?: (action: "confirm" | "reject") => void;
  }): React.ReactElement => (
    <div data-testid="hire-confirmation-card">
      {venueName} {requestedStatus}
      <button type="button" onClick={() => onResponded?.("confirm")}>
        Dismiss confirmation
      </button>
    </div>
  ),
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

function mockDashboardFetches(options: {
  profile?: WorkerProfile | null;
  pending?: Array<{
    id: string;
    requestedStatus: "hired" | "started";
    requestedAt: string;
    venueName: string;
    openingContext: string | null;
  }>;
  stats?: {
    profileViewsLast30Days?: number;
    uniqueRecruiterViewersLast30Days?: number;
    profileViewEventsLast30Days?: number;
    interestReceivedCount?: number;
  };
  recentInterests?: Array<{
    id: string;
    venueName: string;
    openingContext: string | null;
    message: string | null;
    createdAt: string;
  }>;
}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/worker/dashboard")) {
        const unique =
          options.stats?.uniqueRecruiterViewersLast30Days ??
          options.stats?.profileViewsLast30Days ??
          0;
        return {
          ok: true,
          json: async () => ({
            profile: options.profile ?? null,
            stats: {
              profileViewsLast30Days: unique,
              profileViewEventsLast30Days:
                options.stats?.profileViewEventsLast30Days ?? unique,
              uniqueRecruiterViewersLast30Days: unique,
              interestReceivedCount: options.stats?.interestReceivedCount ?? 0,
            },
            recentInterests: options.recentInterests ?? [],
            interestReceivedCount: options.stats?.interestReceivedCount ?? 0,
            pendingConfirmations: options.pending ?? [],
            photoSlots: {
              approvedCount: 0,
              pendingCount: 0,
              slotCount: 0,
              maxSlots: 5,
              remainingSlots: 5,
              canAddGalleryPhoto: false,
            },
            verificationStatus: options.profile?.verificationStatus ?? "unverified",
            isPublished: options.profile?.isPublished ?? false,
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "unexpected" }),
      };
    })
  );
}

describe("WorkerDashboardPage", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    useSession.mockReset();
    mockDashboardFetches({ profile: null });
  });

  it("lets a 0% complete worker stay on the dashboard", async () => {
    mockWorkerSession();
    mockDashboardFetches({ profile: createMockProfile() });

    render(<WorkerDashboardPage />);

    expect(await screen.findByRole("heading", { name: /welcome, ada/i })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith("/worker/onboarding");
    expect(screen.getByRole("button", { name: /complete profile/i })).toBeInTheDocument();
  });

  it("lets a worker below 30% complete stay on the dashboard with Complete Profile", async () => {
    mockWorkerSession();
    mockDashboardFetches({
      profile: createMockProfile({
        photoUrl: "https://example.com/photo.jpg",
      }),
    });

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
    mockDashboardFetches({
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
    });

    render(<WorkerDashboardPage />);

    expect(await screen.findByText(/^complete$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete profile/i })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders database-backed dashboard stats instead of hardcoded zeroes", async () => {
    mockWorkerSession();
    mockDashboardFetches({
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
      stats: {
        uniqueRecruiterViewersLast30Days: 2,
        profileViewEventsLast30Days: 4,
        interestReceivedCount: 1,
      },
      recentInterests: [
        {
          id: "int-1",
          venueName: "Sky Bar",
          openingContext: "Bartender — Central Pattaya",
          message: "Are you free this weekend?",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    render(<WorkerDashboardPage />);

    expect(await screen.findByText("Unique recruiters in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Recruiters interested in you")).toBeInTheDocument();
    expect(screen.getByText("Sky Bar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view profile/i })).toHaveAttribute(
      "href",
      "/worker/profile/preview"
    );
  });

  it("renders WorkerConfirmationCard when a hire confirmation is pending", async () => {
    mockWorkerSession();
    mockDashboardFetches({
      profile: createMockProfile({
        photoUrl: "https://example.com/photo.jpg",
      }),
      pending: [
        {
          id: "conf-1",
          requestedStatus: "hired",
          requestedAt: "2026-03-01T00:00:00.000Z",
          venueName: "Sky Bar",
          openingContext: "Bartender — Central Pattaya",
        },
      ],
    });

    render(<WorkerDashboardPage />);

    expect(await screen.findByTestId("hire-confirmation-card")).toHaveTextContent(
      "Sky Bar hired"
    );
    expect(replace).not.toHaveBeenCalledWith("/worker/onboarding");
    expect(screen.getByRole("button", { name: /complete profile/i })).toBeInTheDocument();
  });

  it("does not restore a dismissed hire confirmation from a later dashboard response", async () => {
    mockWorkerSession();
    mockDashboardFetches({
      profile: createMockProfile({
        photoUrl: "https://example.com/photo.jpg",
      }),
      pending: [
        {
          id: "conf-1",
          requestedStatus: "started",
          requestedAt: "2026-03-01T00:00:00.000Z",
          venueName: "Sky Bar",
          openingContext: "Bartender — Central Pattaya",
        },
      ],
    });

    render(<WorkerDashboardPage />);

    expect(await screen.findByTestId("hire-confirmation-card")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss confirmation/i }));
    expect(screen.queryByTestId("hire-confirmation-card")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId("hire-confirmation-card")).not.toBeInTheDocument();
    });
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
