import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhotoStep } from "../PhotoStep";
import { updateProfilePhoto } from "@/app/worker/actions";
import { uploadProfilePhoto } from "@/lib/media/upload-profile-photo";
import { PROFILE_PHOTO_ERRORS } from "@/lib/media/profile-photo";

vi.mock("@/app/worker/actions", () => ({
  updateProfilePhoto: vi.fn(),
}));

vi.mock("@/lib/media/upload-profile-photo", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/media/upload-profile-photo")>();
  return {
    ...actual,
    uploadProfilePhoto: vi.fn(),
  };
});

const mockedUpload = vi.mocked(uploadProfilePhoto);
const mockedPersist = vi.mocked(updateProfilePhoto);

function jpegFile(): File {
  return new File(["photo-bytes"], "photo.jpg", { type: "image/jpeg" });
}

function selectPhoto(): void {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [jpegFile()] } });
}

describe("PhotoStep upload feedback", () => {
  beforeEach(() => {
    mockedUpload.mockReset();
    mockedPersist.mockReset();
    mockedPersist.mockResolvedValue({ success: true });
    URL.createObjectURL = vi.fn(() => "blob:photo-preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows Preparing photo… and disables controls when a file is selected", async () => {
    let resolveUpload: (value: {
      status: "approved";
      photoKey: string;
      publicUrl: string;
    }) => void = () => undefined;
    mockedUpload.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <PhotoStep
        initialPhotoUrl="https://cdn.example/existing.jpeg"
        onComplete={() => undefined}
      />
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    selectPhoto();

    expect(await screen.findByText("Preparing photo…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    resolveUpload({
      status: "approved",
      photoKey: "profiles/u1/photo.jpeg",
      publicUrl: "https://cdn.example/photo.jpeg",
    });

    await waitFor(() => {
      expect(screen.queryByText("Preparing photo…")).not.toBeInTheDocument();
    });
  });

  it("clears loading state after a successful upload and shows the preview", async () => {
    mockedUpload.mockResolvedValue({
      status: "approved",
      photoKey: "profiles/u1/photo.jpeg",
      publicUrl: "https://cdn.example/photo.jpeg",
    });

    render(<PhotoStep initialPhotoUrl={null} onComplete={() => undefined} />);
    selectPhoto();

    await waitFor(() => {
      expect(screen.queryByText("Preparing photo…")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Change Photo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByAltText("Profile")).toHaveAttribute(
      "src",
      "https://cdn.example/photo.jpeg"
    );
    expect(mockedPersist).toHaveBeenCalledWith({
      photoKey: "profiles/u1/photo.jpeg",
      photoUrl: "https://cdn.example/photo.jpeg",
    });
  });

  it("clears loading state and shows a friendly error when upload fails", async () => {
    mockedUpload.mockRejectedValue(
      new Error(PROFILE_PHOTO_ERRORS.uploadFailed)
    );

    render(<PhotoStep initialPhotoUrl={null} onComplete={() => undefined} />);
    selectPhoto();

    expect(
      await screen.findByText(PROFILE_PHOTO_ERRORS.uploadFailed)
    ).toBeInTheDocument();
    expect(screen.queryByText("Preparing photo…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Photo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("uses a placeholder instead of a broken-image icon when the preview fails", async () => {
    mockedUpload.mockResolvedValue({
      status: "approved",
      photoKey: "profiles/u1/photo.jpeg",
      publicUrl: "https://cdn.example/broken.jpeg",
    });

    render(<PhotoStep initialPhotoUrl={null} onComplete={() => undefined} />);
    selectPhoto();

    const preview = await screen.findByAltText("Profile");
    fireEvent.error(preview);

    expect(
      await screen.findByText(PROFILE_PHOTO_ERRORS.previewFailed)
    ).toBeInTheDocument();
    expect(screen.queryByAltText("Profile")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("shows Photo under review for a pending upload and does not persist a public URL", async () => {
    mockedUpload.mockResolvedValue({
      status: "pending",
      photoKey: null,
      publicUrl: null,
      message: "Photo under review — your profile stays visible with your previous photo until approved.",
    });

    render(<PhotoStep initialPhotoUrl={null} onComplete={() => undefined} />);
    selectPhoto();

    expect(
      await screen.findByText(/Photo under review/)
    ).toBeInTheDocument();
    expect(mockedPersist).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByAltText("Profile").getAttribute("src")).toMatch(
      /^blob:/
    );
  });
});
