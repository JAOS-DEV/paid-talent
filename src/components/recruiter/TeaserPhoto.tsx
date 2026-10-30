"use client";

import React, { useState } from "react";

interface TeaserPhotoProps {
  src: string;
  className?: string;
}

function PhotoPlaceholder(): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center bg-charcoal-700">
      <svg
        className="h-8 w-8 text-charcoal-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
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

export function TeaserPhoto({
  src,
  className = "h-16 w-16",
}: TeaserPhotoProps): React.ReactElement {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`shrink-0 overflow-hidden rounded-full bg-charcoal-700 ${className}`}>
      {failed ? (
        <PhotoPlaceholder />
      ) : (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
