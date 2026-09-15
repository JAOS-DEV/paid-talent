import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import type { WorkerProfile } from "@/lib/db/schema";

const replace = vi.fn();
const push = vi.fn();
const router = { replace, push };
const useSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
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
  PhotoStep: ({
    onComplete,
  }: {
    onComplete: () => void;
  }): React.ReactElement => (
    <div>
      PhotoStep
      <button
        type="button"
        onClick={() => {
          void onComplete();
        }}
      >
        complete-photo
      </button>
    </div>
  ),
  NameStep: ({
    initialName,
    onBack,
  }: {
    initialName: string;
    onBack: () => void;
  }): React.ReactElement => (
    <div>
      NameStep
      <span>initial-name:{initialName}</span>
      <button type="button" onClick={onBack}>
        back-name
      </button>
    </div>
  ),
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
    availability: [],
    expectedPayMin: null,
    expectedPayMax: null,
    payCurrency: "THB",
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
            availability: ["Full-time"],
          }),
        }),
      })
    );

    render(<WorkerOnboardingPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/worker/dashboard");
    });
  });

  it("starts on photo even when Google already populated the display name", async () => {
    mockWorkerSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: createMockProfile({
            displayName: "Ada from Google",
          }),
        }),
      })
    );

    render(<WorkerOnboardingPage />);

    expect(await screen.findByText("PhotoStep")).toBeInTheDocument();
    expect(screen.getByText("stepper:photo")).toBeInTheDocument();
    expect(screen.queryByText("NameStep")).not.toBeInTheDocument();
  });

  it("advances photo to name, keeps Google name, and navigates back", async () => {
    mockWorkerSession();
    const profile = createMockProfile({
      displayName: "Ada from Google",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profile }),
      })
    );

    render(<WorkerOnboardingPage />);

    expect(await screen.findByText("PhotoStep")).toBeInTheDocument();
    expect(screen.getByText("stepper:photo")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^complete-photo$/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("stepper:name")).toBeInTheDocument();
    });
    expect(screen.getByText("NameStep")).toBeInTheDocument();
    expect(screen.getByText("initial-name:Ada from Google")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^back-name$/ }));

    await waitFor(() => {
      expect(screen.getByText("stepper:photo")).toBeInTheDocument();
    });
    expect(screen.getByText("PhotoStep")).toBeInTheDocument();
  });
});
