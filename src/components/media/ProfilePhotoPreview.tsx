"use client";

import React from "react";

interface ProfilePhotoPreviewProps {
  photoUrl: string | null;
  uploading: boolean;
  previewFailed: boolean;
  onPreviewError: () => void;
  sizeClassName: string;
}

function ProfilePhotoPlaceholder(): React.ReactElement {
  return (
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
  );
}

export function ProfilePhotoPreview({
  photoUrl,
  uploading,
  previewFailed,
  onPreviewError,
  sizeClassName,
}: ProfilePhotoPreviewProps): React.ReactElement {
  const showImage = Boolean(photoUrl) && !previewFailed;

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-charcoal-800 border-2 border-charcoal-600 ${sizeClassName}`}
    >
      {showImage ? (
        // Arbitrary public media hosts need a native img onError fallback.
        // eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns
        <img
          src={photoUrl ?? undefined}
          alt="Profile"
          className="w-full h-full object-cover"
          onError={onPreviewError}
        />
      ) : (
        <ProfilePhotoPlaceholder />
      )}
      {uploading ? (
        <div className="absolute inset-0 bg-charcoal-950/70 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : null}
    </div>
  );
}
