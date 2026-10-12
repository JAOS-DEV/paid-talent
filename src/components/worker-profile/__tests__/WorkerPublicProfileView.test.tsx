import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkerPublicProfileView } from "../WorkerPublicProfileView";
import type {
  PublicWorkerProfileView,
  WorkerOwnPreviewView,
} from "@/lib/worker-profile/public-profile";

const SECRET_LINE = "only_me_line";
const SECRET_WHATSAPP = "+66111222333";
const SECRET_PHONE = "+66444555666";

function baseProfile(
  overrides: Partial<PublicWorkerProfileView> = {}
): PublicWorkerProfileView {
  return {
    id: "profile-1",
    displayName: "Nattaya B.",
    photoUrl: null,
    photos: [],
    location: "Bangkok",
    area: "Sukhumvit",
    bio: "Hostess",
    description: null,
    jobRoles: ["Hostess"],
    experience: null,
    experienceYears: 3,
    languages: ["Thai"],
    availability: ["Full-time"],
    expectedPayMin: 20000,
    expectedPayMax: null,
    expectedPayPeriod: "month",
    payCurrency: "THB",
    isVerified: true,
    isTopTalent: true,
    ...overrides,
  };
}

describe("WorkerPublicProfileView contact privacy", () => {
  it("recruiter mode shows private contact card and no contact values", () => {
    render(
      <WorkerPublicProfileView profile={baseProfile()} mode="recruiter" />
    );

    expect(screen.getByTestId("contact-private-card")).toBeInTheDocument();
    expect(screen.getByText("Contact details are private")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Talent share their LINE or number with you in chat after accepting your contact request."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(SECRET_LINE)).not.toBeInTheDocument();
    expect(screen.queryByText(SECRET_WHATSAPP)).not.toBeInTheDocument();
    expect(screen.queryByText(SECRET_PHONE)).not.toBeInTheDocument();
    expect(screen.queryByTestId("own-contact-card")).not.toBeInTheDocument();
  });

  it("preview mode shows own contact values and privacy note", () => {
    const profile: WorkerOwnPreviewView = {
      ...baseProfile(),
      ownContact: {
        lineId: SECRET_LINE,
        whatsappNumber: SECRET_WHATSAPP,
        phoneNumber: SECRET_PHONE,
      },
    };

    render(<WorkerPublicProfileView profile={profile} mode="preview" />);

    expect(screen.getByTestId("own-contact-card")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Only you can see this. Recruiters never see your contact details unless you share them in chat."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(SECRET_LINE)).toBeInTheDocument();
    expect(screen.getByText(SECRET_WHATSAPP)).toBeInTheDocument();
    expect(screen.getByText(SECRET_PHONE)).toBeInTheDocument();
    expect(screen.queryByTestId("contact-private-card")).not.toBeInTheDocument();
  });
});
