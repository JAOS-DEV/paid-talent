import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VenueLogoPicker } from "../VenueLogoPicker";
import { RecruiterProfileForm } from "../RecruiterProfileForm";
import {
  clearVenueLogo,
  uploadVenueLogo,
} from "@/lib/media/upload-venue-logo";

vi.mock("@/lib/media/upload-venue-logo", () => ({
  uploadVenueLogo: vi.fn(),
  clearVenueLogo: vi.fn(),
  venueLogoFailureMessage: (error: unknown) =>
    error instanceof Error ? error.message : "We couldn't upload your logo. Please try again.",
}));

vi.mock("@/lib/recruiter-profile/actions", () => ({
  updateRecruiterProfile: vi.fn(),
}));

const mockedUpload = vi.mocked(uploadVenueLogo);
const mockedClear = vi.mocked(clearVenueLogo);

function jpegFile(): File {
  return new File(["logo-bytes"], "logo.jpg", { type: "image/jpeg" });
}

describe("VenueLogoPicker", () => {
  beforeEach(() => {
    mockedUpload.mockReset();
    mockedClear.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:logo-preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("exposes a working file input on the empty Add logo control", () => {
    render(<VenueLogoPicker logoUrl={null} onChange={() => undefined} />);
    const input = screen.getByLabelText("Add logo");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(screen.getByText("Add logo")).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("uploads a replacement and can clear the saved logo", async () => {
    const onChange = vi.fn();
    mockedUpload.mockResolvedValue({
      logoKey: "profiles/u1/logo.jpeg",
      logoUrl: "https://cdn.example/profiles/u1/logo.jpeg",
    });
    mockedClear.mockResolvedValue(undefined);

    const { rerender } = render(
      <VenueLogoPicker logoUrl={null} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Add logo"), {
      target: { files: [jpegFile()] },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        logoKey: "profiles/u1/logo.jpeg",
        logoUrl: "https://cdn.example/profiles/u1/logo.jpeg",
      });
    });

    rerender(
      <VenueLogoPicker
        logoUrl="https://cdn.example/profiles/u1/logo.jpeg"
        onChange={onChange}
      />
    );

    expect(screen.getByAltText("Venue logo preview")).toHaveAttribute(
      "src",
      "https://cdn.example/profiles/u1/logo.jpeg"
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    await waitFor(() => {
      expect(mockedClear).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith({ logoKey: null, logoUrl: null });
    });
  });
});

describe("RecruiterProfileForm logo copy", () => {
  it("describes the logo as optional and shows the file control", () => {
    render(<RecruiterProfileForm initialProfile={null} />);
    expect(
      screen.getByText("Optional. Shows on your openings.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Add logo")).toHaveAttribute("type", "file");
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});
