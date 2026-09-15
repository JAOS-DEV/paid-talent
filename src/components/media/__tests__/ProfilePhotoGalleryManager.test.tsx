import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfilePhotoGalleryManager } from "../ProfilePhotoGalleryManager";
import { PHOTO_POLICY_COPY } from "@/lib/moderation/photo-policy";
import type { WorkerOwnedPhoto } from "@/lib/worker-dashboard";

vi.mock("@/lib/media/upload-profile-photo", () => ({
  uploadProfilePhoto: vi.fn(),
}));

function photo(overrides: Partial<WorkerOwnedPhoto> = {}): WorkerOwnedPhoto {
  return {
    id: "photo-1",
    photoUrl: "https://cdn.example/a.jpg",
    previewUrl: null,
    moderationStatus: "approved",
    moderationReason: null,
    displayOrder: 0,
    isCurrentApproved: true,
    createdAt: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProfilePhotoGalleryManager status UX", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          photos: [
            photo(),
            photo({
              id: "photo-2",
              photoUrl: "https://cdn.example/b.jpg",
              isCurrentApproved: false,
              displayOrder: 1,
            }),
            photo({
              id: "photo-3",
              photoUrl: null,
              previewUrl: "https://signed.example/pending.jpg",
              moderationStatus: "pending",
              isCurrentApproved: false,
              displayOrder: 2,
            }),
            photo({
              id: "photo-4",
              photoUrl: null,
              previewUrl: null,
              moderationStatus: "rejected",
              moderationReason: "Please upload a clear face-forward photo.",
              isCurrentApproved: false,
              displayOrder: 3,
            }),
          ],
        }),
      })
    );
  });

  it("renders compact status pills and rejected remove/reason copy", async () => {
    render(<ProfilePhotoGalleryManager isVerified />);

    expect(await screen.findByTestId("photo-status-primary")).toHaveTextContent(
      "Primary"
    );
    expect(screen.getByTestId("photo-status-approved")).toHaveTextContent(
      "Approved"
    );
    expect(screen.getByTestId("photo-status-pending-review")).toHaveTextContent(
      "Pending review"
    );
    expect(screen.getByTestId("photo-status-rejected")).toHaveTextContent(
      "Rejected"
    );
    expect(
      screen.getByText("Please upload a clear face-forward photo.")
    ).toBeInTheDocument();
    expect(screen.getByText(PHOTO_POLICY_COPY.pending)).toBeInTheDocument();
    expect(screen.getAllByText(PHOTO_POLICY_COPY.rules).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Lingerie OK/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make primary" })).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons.length).toBeGreaterThan(0);
  });

  it("asks the API to make an approved gallery photo primary", async () => {
    render(<ProfilePhotoGalleryManager isVerified />);
    const makePrimary = await screen.findByRole("button", { name: "Make primary" });
    fireEvent.click(makePrimary);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/worker/photos/photo-2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "makePrimary" }),
        })
      );
    });
  });
});
