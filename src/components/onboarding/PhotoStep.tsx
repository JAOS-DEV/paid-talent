"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui";
import { updateProfilePhoto } from "@/app/worker/actions";

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

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const presignedRes = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          folder: "profiles",
        }),
      });

      if (!presignedRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, key, publicUrl } = await presignedRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      const confirmRes = await fetch("/api/media/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, publicUrl }),
      });

      if (!confirmRes.ok) {
        const data = await confirmRes.json();
        throw new Error(data.error || "Failed to confirm upload");
      }

      setPhotoUrl(publicUrl);
      await updateProfilePhoto({ photoKey: key, photoUrl: publicUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
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
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {photoUrl ? "Change Photo" : "Upload Photo"}
        </Button>

        <p className="text-charcoal-500 text-xs mt-2">
          JPG, PNG or WebP. Max 5MB.
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
