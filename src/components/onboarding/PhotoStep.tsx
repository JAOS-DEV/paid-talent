"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { updateProfilePhoto } from "@/app/worker/actions";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_STATUS,
  type ProfilePhotoUploadStage,
} from "@/lib/media/profile-photo";
import { uploadProfilePhoto } from "@/lib/media/upload-profile-photo";
import { ProfilePhotoPreview } from "@/components/media/ProfilePhotoPreview";

interface PhotoStepProps {
  initialPhotoUrl: string | null;
  onComplete: () => void;
}

export function PhotoStep({
  initialPhotoUrl,
  onComplete,
}: PhotoStepProps): React.ReactElement {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] =
    useState<ProfilePhotoUploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const isBusy = uploading;
  const continueDisabled = isBusy || !photoUrl;
  const statusText = uploadStage ? PROFILE_PHOTO_STATUS[uploadStage] : null;
  const chooseLabel = photoUrl ? "Change Photo" : "Upload Photo";

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
      const persist = await updateProfilePhoto({
        photoKey: result.key,
        photoUrl: result.publicUrl,
      });
      if (!persist.success) {
        throw new Error(
          persist.error || PROFILE_PHOTO_ERRORS.uploadFailed
        );
      }
      setPhotoUrl(result.publicUrl);
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
    if (!isBusy && photoUrl) {
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

        <p className="text-charcoal-500 text-xs mt-2">
          JPG, PNG or WebP. Max 10MB. Photos are resized on your device.
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
          Continue
        </Button>
      </div>
    </div>
  );
}
