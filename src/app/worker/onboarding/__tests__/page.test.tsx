import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

vi.mock("@/components/layout", () => ({
  Header: (): React.ReactElement => <header>Header</header>,
  Footer: (): React.ReactElement => <footer>Footer</footer>,
}));

vi.mock("@/components/onboarding", () => ({
  OnboardingStepper: ({
    currentStepId,
  }: {
    currentStepId: string;
  }): React.ReactElement => <div>stepper:{currentStepId}</div>,
  PhotoStep: (): React.ReactElement => <div>PhotoStep</div>,
  NameStep: (): React.ReactElement => <div>NameStep</div>,
  RolesStep: (): React.ReactElement => <div>RolesStep</div>,
  ExperienceStep: (): React.ReactElement => <div>ExperienceStep</div>,
  LanguagesStep: (): React.ReactElement => <div>LanguagesStep</div>,
  BioStep: (): React.ReactElement => <div>BioStep</div>,
  LocationStep: (): React.ReactElement => <div>LocationStep</div>,
  ContactStep: (): React.ReactElement => <div>ContactStep</div>,
}));

import WorkerOnboardingPage from "../page";

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

describe("WorkerOnboardingPage", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    useSession.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profile: createMockProfile() }),
      })
    );
  });

  it("Finish later navigates to the dashboard and does not bounce back", async () => {
    mockWorkerSession();
    render(<WorkerOnboardingPage />);

    const finishLater = await screen.findByRole("button", { name: /finish later/i });
    fireEvent.click(finishLater);

    expect(push).toHaveBeenCalledWith("/worker/dashboard");
    expect(replace).not.toHaveBeenCalledWith("/worker/onboarding");
  });

  it("resumes at the first incomplete required step", async () => {
    mockWorkerSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: createMockProfile({
            photoUrl: "https://example.com/photo.jpg",
            jobRoles: ["Bartender"],
          }),
        }),
      })
    );

    render(<WorkerOnboardingPage />);

    expect(await screen.findByText("NameStep")).toBeInTheDocument();
    expect(screen.getByText("stepper:name")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a complete profile to the dashboard", async () => {
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

    render(<WorkerOnboardingPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/worker/dashboard");
    });
  });
});
