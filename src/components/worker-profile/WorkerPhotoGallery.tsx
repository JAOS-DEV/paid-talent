"use client";

import React, { useState } from "react";
import {
  splitPublicPhotos,
  type PublicWorkerPhoto,
} from "@/lib/worker-profile/public-profile";

interface WorkerPhotoGalleryProps {
  displayName: string;
  photoUrl: string | null;
  photos: PublicWorkerPhoto[];
}

function ProfilePlaceholder({
  sizeClassName,
}: {
  sizeClassName: string;
}): React.ReactElement {
  return (
    <div
      className={`${sizeClassName} rounded-2xl bg-charcoal-700 flex-shrink-0 flex items-center justify-center`}
    >
      <svg
        className="w-12 h-12 text-charcoal-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </div>
  );
}

export function WorkerPhotoGallery({
  displayName,
  photoUrl,
  photos,
}: WorkerPhotoGalleryProps): React.ReactElement {
  const { primaryUrl, additional } = splitPublicPhotos(photos, photoUrl);
  const [activeUrl, setActiveUrl] = useState(primaryUrl);

  const shownUrl = activeUrl || primaryUrl;

  return (
    <div className="w-full min-w-0 space-y-3" data-testid="worker-photo-gallery">
      {shownUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns
        <img
          src={shownUrl}
          alt={displayName}
          className="w-full max-h-96 object-cover rounded-2xl bg-charcoal-800"
        />
      ) : (
        <ProfilePlaceholder sizeClassName="w-full h-48" />
      )}

      {additional.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {primaryUrl ? (
            <button
              type="button"
              onClick={() => setActiveUrl(primaryUrl)}
              className={`flex-shrink-0 rounded-xl overflow-hidden border-2 min-h-16 min-w-16 ${
                shownUrl === primaryUrl
                  ? "border-primary-500"
                  : "border-transparent"
              }`}
              aria-label="Show primary photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns */}
              <img
                src={primaryUrl}
                alt=""
                className="w-16 h-16 object-cover"
              />
            </button>
          ) : null}
          {additional.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActiveUrl(photo.photoUrl)}
              className={`flex-shrink-0 rounded-xl overflow-hidden border-2 min-h-16 min-w-16 ${
                shownUrl === photo.photoUrl
                  ? "border-primary-500"
                  : "border-transparent"
              }`}
              aria-label={`Show photo ${index + 2}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns */}
              <img
                src={photo.photoUrl}
                alt=""
                className="w-16 h-16 object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
