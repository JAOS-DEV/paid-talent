"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { updateProfilePhoto } from "@/app/worker/actions";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_STATUS,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import {
  isApprovedPublicPhotoUpload,
  uploadProfilePhoto,
} from "@/lib/media/upload-profile-photo";
import { ProfilePhotoPreview } from "@/components/media/ProfilePhotoPreview";
import { PHOTO_POLICY_COPY } from "@/lib/moderation/photo-policy";

interface PhotoStepProps {
  initialPhotoUrl: string | null;
  initialPendingReview?: boolean;
  onComplete: () => void;
}

export function PhotoStep({
  initialPhotoUrl,
  initialPendingReview = false,
  onComplete,
}: PhotoStepProps): React.ReactElement {
  const t = useTranslations("worker.profile");
  const common = useTranslations("common");
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] =
    useState<ProfilePhotoUploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pendingReview, setPendingReview] = useState(initialPendingReview);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const localPreviewUrlRef = useRef<string | null>(null);

  const isBusy = uploading;
  const continueDisabled = isBusy || (!photoUrl && !pendingReview);
  const statusText = uploadStage ? PROFILE_PHOTO_STATUS[uploadStage] : null;
  const chooseLabel =
    photoUrl || pendingReview ? t("changePhoto") : t("uploadPhoto");

  useEffect(() => {
    return () => {
      if (
        localPreviewUrlRef.current &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
      }
    };
  }, []);

  function replaceLocalPreview(file: File): string | null {
    if (typeof URL.createObjectURL !== "function") {
      return null;
    }
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    localPreviewUrlRef.current = url;
    return url;
  }

  function clearLocalPreview(): void {
    if (localPreviewUrlRef.current && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }
  }

  async function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || uploadingRef.current) return;

    uploadingRef.current = true;
    setError(null);
    setPreviewFailed(false);
    setUploading(true);
    setUploadStage("preparing");

    try {
      const result = await uploadProfilePhoto(file, {
        onStage: setUploadStage,
      });
      setUploadStage("saving");

      if (result.status === "rejected") {
        clearLocalPreview();
        setPendingReview(false);
        setPhotoUrl(initialPhotoUrl);
        setError(result.message || PHOTO_POLICY_COPY.rejected);
        return;
      }

      if (isApprovedPublicPhotoUpload(result)) {
        const persist = await updateProfilePhoto({
          photoKey: result.photoKey,
          photoUrl: result.publicUrl,
        });
        if (!persist.success) {
          throw new Error(
            persist.error || PROFILE_PHOTO_ERRORS.uploadFailed
          );
        }
        clearLocalPreview();
        setPendingReview(false);
        setPhotoUrl(result.publicUrl);
        return;
      }

      setPendingReview(true);
      const localPreview = replaceLocalPreview(file);
      if (localPreview) {
        setPhotoUrl(localPreview);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : PROFILE_PHOTO_ERRORS.uploadFailed
      );
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setUploadStage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleChoosePhoto(): void {
    if (uploadingRef.current) return;
    fileInputRef.current?.click();
  }

  function handleContinue(): void {
    if (!isBusy && (photoUrl || pendingReview)) {
      onComplete();
    }
  }

  function handlePreviewError(): void {
    setPreviewFailed(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center">
        <div className="mb-4">
          <ProfilePhotoPreview
            photoUrl={photoUrl}
            uploading={isBusy}
            previewFailed={previewFailed}
            onPreviewError={handlePreviewError}
            sizeClassName="w-32 h-32"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={PROFILE_PHOTO_ACCEPT}
          className="hidden"
          disabled={isBusy}
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          onClick={handleChoosePhoto}
          disabled={isBusy}
        >
          {chooseLabel}
        </Button>

        {statusText ? (
          <p className="text-charcoal-300 text-sm mt-3" aria-live="polite">
            {statusText}
          </p>
        ) : null}

        {pendingReview && !isBusy ? (
          <p className="text-charcoal-300 text-sm mt-3 text-center">
            {PHOTO_POLICY_COPY.pending}
          </p>
        ) : null}

        <p className="text-charcoal-500 text-xs mt-2">
          {t("photoHint")}
        </p>
        <p className="text-charcoal-500 text-xs mt-1 text-center">
          {PHOTO_POLICY_COPY.rules}
        </p>

        {previewFailed && photoUrl ? (
          <p className="text-charcoal-300 text-sm mt-2">
            {PROFILE_PHOTO_ERRORS.previewFailed}
          </p>
        ) : null}

        {error ? <p className="text-error text-sm mt-2">{error}</p> : null}
      </div>

      <div className="pt-4">
        <Button fullWidth onClick={handleContinue} disabled={continueDisabled}>
          {common("continue")}
        </Button>
      </div>
    </div>
  );
}
