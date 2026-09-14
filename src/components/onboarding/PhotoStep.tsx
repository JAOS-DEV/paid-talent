"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui";
import { updateProfilePhoto } from "@/app/worker/actions";
import {
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_ERRORS,
} from "@/lib/media/profile-photo";
import { uploadProfilePhoto } from "@/lib/media/upload-profile-photo";

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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const result = await uploadProfilePhoto(file, { fetch });
      setPhotoUrl(result.publicUrl);
      await updateProfilePhoto({
        photoKey: result.key,
        photoUrl: result.publicUrl,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : PROFILE_PHOTO_ERRORS.uploadFailed
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleChoosePhoto(): void {
    fileInputRef.current?.click();
  }

  function handleContinue(): void {
    if (photoUrl) {
      onComplete();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32 rounded-full overflow-hidden bg-charcoal-800 border-2 border-charcoal-600 mb-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-16 h-16 text-charcoal-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7 7z"
                />
              </svg>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-charcoal-950/70 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={PROFILE_PHOTO_ACCEPT}
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          onClick={handleChoosePhoto}
          disabled={uploading}
        >
          {photoUrl ? "Change Photo" : "Upload Photo"}
        </Button>

        <p className="text-charcoal-500 text-xs mt-2">
          JPG, PNG or WebP. Max 10MB. Photos are resized on your device.
        </p>

        {error && <p className="text-error text-sm mt-2">{error}</p>}
      </div>

      <div className="pt-4">
        <Button fullWidth onClick={handleContinue} disabled={!photoUrl}>
          Continue
        </Button>
      </div>
    </div>
  );
}
