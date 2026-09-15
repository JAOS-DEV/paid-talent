"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_STATUS,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import { uploadProfilePhoto } from "@/lib/media/upload-profile-photo";
import { checkPhotoLimits, PHOTO_POLICY_COPY } from "@/lib/moderation/photo-policy";
import type { WorkerOwnedPhoto } from "@/lib/worker-dashboard";
import { PhotoStatusPill } from "@/components/media/PhotoStatusPill";

interface ProfilePhotoGalleryManagerProps {
  isVerified: boolean;
}

function thumbnailUrl(photo: WorkerOwnedPhoto): string | null {
  return photo.photoUrl ?? photo.previewUrl;
}

function sortForDisplay(photos: WorkerOwnedPhoto[]): WorkerOwnedPhoto[] {
  return [...photos].sort((left, right) => {
    if (left.isCurrentApproved !== right.isCurrentApproved) {
      return left.isCurrentApproved ? -1 : 1;
    }
    return left.displayOrder - right.displayOrder;
  });
}

export function ProfilePhotoGalleryManager({
  isVerified,
}: ProfilePhotoGalleryManagerProps): React.ReactElement {
  const [photos, setPhotos] = useState<WorkerOwnedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<ProfilePhotoUploadStage | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/worker/photos");
    if (!response.ok) {
      setError("Failed to load photos");
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { photos?: WorkerOwnedPhoto[] };
    setPhotos(sortForDisplay(data.photos ?? []));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run(): Promise<void> {
      const response = await fetch("/api/worker/photos");
      if (cancelled) return;
      if (!response.ok) {
        setError("Failed to load photos");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { photos?: WorkerOwnedPhoto[] };
      if (cancelled) return;
      setPhotos(sortForDisplay(data.photos ?? []));
      setError(null);
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const approvedCount = photos.filter(
    (photo) => photo.moderationStatus === "approved"
  ).length;
  const pendingCount = photos.filter(
    (photo) => photo.moderationStatus === "pending"
  ).length;
  const slotCount = approvedCount + pendingCount;
  const remaining = Math.max(0, 5 - slotCount);
  const galleryLimit = checkPhotoLimits(approvedCount, pendingCount, {
    purpose: "gallery",
    isVerified,
  });
  const canAdd = galleryLimit.canUpload && !uploading;
  const canChoosePrimary = approvedCount > 1;

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setUploadStage("preparing");
    setError(null);
    try {
      await uploadProfilePhoto(file, {
        purpose: "gallery",
        onStage: setUploadStage,
      });
      await loadPhotos();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : PROFILE_PHOTO_ERRORS.uploadFailed
      );
    } finally {
      setUploading(false);
      setUploadStage(null);
      event.target.value = "";
    }
  }

  async function handleDelete(photoId: string): Promise<void> {
    setError(null);
    const response = await fetch(`/api/worker/photos/${photoId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Failed to remove photo");
      return;
    }
    await loadPhotos();
  }

  async function handleMove(
    photoId: string,
    direction: "up" | "down"
  ): Promise<void> {
    setError(null);
    const response = await fetch(`/api/worker/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Failed to reorder photo");
      return;
    }
    await loadPhotos();
  }

  async function handleMakePrimary(photoId: string): Promise<void> {
    setError(null);
    const response = await fetch(`/api/worker/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "makePrimary" }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Failed to set primary photo");
      return;
    }
    await loadPhotos();
  }

  const additionalApproved = photos.filter(
    (photo) =>
      photo.moderationStatus === "approved" && !photo.isCurrentApproved
  );

  return (
    <div id="photos" data-testid="profile-photo-gallery">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-charcoal-400">
          {slotCount} of 5 photos
        </p>
        {canAdd ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            Add photo
          </Button>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={PROFILE_PHOTO_ACCEPT}
        className="hidden"
        disabled={!canAdd}
        onChange={(event) => {
          void handleUpload(event);
        }}
      />

      {!isVerified ? (
        <p className="text-sm text-charcoal-400 mb-4">
          Additional photos are available after identity verification is
          approved.
        </p>
      ) : (
        <p className="text-sm text-charcoal-400 mb-4">
          Your primary verification photo is photo 1. You can add up to four
          more photos for recruiters
          {remaining > 0
            ? `, including while others are under review (${remaining} remaining)`
            : ""}. New photos stay private until they are approved.
        </p>
      )}
      <p className="text-sm text-charcoal-400 mb-4">{PHOTO_POLICY_COPY.rules}</p>

      {uploadStage ? (
        <p className="text-charcoal-300 text-sm mb-3" aria-live="polite">
          {PROFILE_PHOTO_STATUS[uploadStage]}
        </p>
      ) : null}
      {error ? <p className="text-error text-sm mb-3">{error}</p> : null}

      {loading ? (
        <div className="h-24 rounded-xl bg-charcoal-800 animate-pulse" />
      ) : photos.length === 0 ? (
        <p className="text-sm text-charcoal-500">No profile photos yet.</p>
      ) : (
        <ul className="space-y-3">
          {photos.map((photo, index) => {
            const canMove =
              photo.moderationStatus === "approved" && !photo.isCurrentApproved;
            const siblingIndex = additionalApproved.findIndex(
              (item) => item.id === photo.id
            );
            const thumb = thumbnailUrl(photo);
            const supportingCopy =
              photo.moderationStatus === "rejected" && photo.moderationReason
                ? photo.moderationReason
                : photo.moderationStatus === "pending"
                  ? PHOTO_POLICY_COPY.pending
                  : PHOTO_POLICY_COPY.rules;
            return (
              <li
                key={photo.id}
                className="flex items-start gap-3 rounded-xl border border-charcoal-700 p-3 min-w-0"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-charcoal-800 flex-shrink-0">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-charcoal-500 text-xs px-1 text-center">
                      {photo.moderationStatus === "pending"
                        ? "In review"
                        : "Hidden"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PhotoStatusPill photo={photo} />
                  </div>
                  <p
                    className={`text-xs mt-1 break-words ${
                      photo.moderationStatus === "rejected"
                        ? "text-red-300"
                        : "text-charcoal-500"
                    }`}
                  >
                    {supportingCopy}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {canChoosePrimary &&
                    photo.moderationStatus === "approved" &&
                    !photo.isCurrentApproved ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          void handleMakePrimary(photo.id);
                        }}
                      >
                        Make primary
                      </Button>
                    ) : null}
                    {canMove && siblingIndex > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          void handleMove(photo.id, "up");
                        }}
                      >
                        Move up
                      </Button>
                    ) : null}
                    {canMove && siblingIndex >= 0 && siblingIndex < additionalApproved.length - 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          void handleMove(photo.id, "down");
                        }}
                      >
                        Move down
                      </Button>
                    ) : null}
                    {photo.isCurrentApproved ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          void handleDelete(photo.id);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <span className="sr-only">Photo {index + 1}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
