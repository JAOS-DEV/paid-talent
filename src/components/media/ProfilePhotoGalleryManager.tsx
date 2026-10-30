"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_ERRORS,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import { uploadProfilePhoto } from "@/lib/media/upload-profile-photo";
import {
  checkPhotoLimits,
} from "@/lib/moderation/photo-policy";
import type { WorkerOwnedPhoto } from "@/lib/worker-dashboard";
import { PhotoStatusPill } from "@/components/media/PhotoStatusPill";

interface ProfilePhotoGalleryManagerProps {
  isVerified: boolean;
  hasApprovedPrimaryPhoto?: boolean;
}

function thumbnailUrl(photo: WorkerOwnedPhoto): string | null {
  return photo.photoUrl ?? photo.previewUrl;
}

function galleryErrorMessage(
  message: string,
  t: (
    key: "tooLarge" | "heic" | "invalidType" | "uploadFailed"
  ) => string
): string {
  if (message === PROFILE_PHOTO_ERRORS.tooLarge) return t("tooLarge");
  if (message === PROFILE_PHOTO_ERRORS.heic) return t("heic");
  if (message === PROFILE_PHOTO_ERRORS.invalidType) return t("invalidType");
  if (message === PROFILE_PHOTO_ERRORS.uploadFailed) return t("uploadFailed");
  return message;
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
  hasApprovedPrimaryPhoto = false,
}: ProfilePhotoGalleryManagerProps): React.ReactElement {
  const t = useTranslations("gallery");
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
      setError(t("loadFailed"));
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { photos?: WorkerOwnedPhoto[] };
    setPhotos(sortForDisplay(data.photos ?? []));
    setError(null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    async function run(): Promise<void> {
      const response = await fetch("/api/worker/photos");
      if (cancelled) return;
      if (!response.ok) {
        setError(t("loadFailed"));
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
  }, [t]);

  const approvedCount = photos.filter(
    (photo) => photo.moderationStatus === "approved"
  ).length;
  const pendingCount = photos.filter(
    (photo) => photo.moderationStatus === "pending"
  ).length;
  const slotCount = approvedCount + pendingCount;
  const remaining = Math.max(0, 5 - slotCount);
  const hasApprovedPrimary =
    hasApprovedPrimaryPhoto ||
    photos.some(
      (photo) =>
        photo.isCurrentApproved &&
        photo.moderationStatus === "approved" &&
        Boolean(photo.photoUrl)
    );
  const galleryLimit = checkPhotoLimits(approvedCount, pendingCount, {
    purpose: "gallery",
    isVerified,
    hasApprovedPrimary,
  });
  const canAdd = galleryLimit.canUpload && !uploading;
  const canChoosePrimary = approvedCount > 1;
  const galleryGuidance = !isVerified
    ? t("unverified")
    : !hasApprovedPrimary
      ? t("primaryPending")
      : t("guidance", {
          extra: remaining > 0 ? t("guidanceExtra", { count: remaining }) : "",
        });

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
          ? galleryErrorMessage(uploadError.message, t)
          : t("uploadFailed")
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
      setError(body?.error ?? t("removeFailed"));
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
      setError(body?.error ?? t("reorderFailed"));
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
      setError(body?.error ?? t("primaryFailed"));
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
          {t("count", { count: slotCount })}
        </p>
        {canAdd ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            data-testid="add-gallery-photo"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {t("addPhoto")}
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

      <p className="text-sm text-charcoal-400 mb-4">{galleryGuidance}</p>
      <p className="text-sm text-charcoal-200 mb-4">{t("rules")}</p>

      {uploadStage ? (
        <p className="text-charcoal-300 text-sm mb-3" aria-live="polite">
          {t(uploadStage)}
        </p>
      ) : null}
      {error ? <p className="text-error text-sm mb-3">{error}</p> : null}

      {loading ? (
        <div className="h-24 rounded-xl bg-charcoal-800 animate-pulse" />
      ) : photos.length === 0 ? (
        <p className="text-sm text-charcoal-300">{t("noPhotos")}</p>
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
                  ? t("pending")
                  : null;
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
                    <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-xs px-1 text-center">
                      {photo.moderationStatus === "pending"
                        ? t("inReview")
                        : t("hidden")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PhotoStatusPill photo={photo} />
                  </div>
                  {supportingCopy ? (
                    <p
                      className={`mt-1 break-words text-xs ${
                        photo.moderationStatus === "rejected"
                          ? "text-red-300"
                          : "text-charcoal-300"
                      }`}
                    >
                      {supportingCopy}
                    </p>
                  ) : null}
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
                        {t("makePrimary")}
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
                        {t("moveUp")}
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
                        {t("moveDown")}
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
                        {t("remove")}
                      </Button>
                    )}
                  </div>
                </div>
                <span className="sr-only">{t("photoNumber", { number: index + 1 })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
