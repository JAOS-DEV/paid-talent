"use client";

import React, { useCallback, useEffect, useState } from "react";
import { isDesktopRiskyLivenessContentType } from "@/lib/verification/liveness-recording";

export interface AdminLivenessVideoPlayerProps {
  url: string;
  contentType: string | null;
}

export function AdminLivenessVideoPlayer({
  url,
  contentType,
}: AdminLivenessVideoPlayerProps): React.ReactElement {
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const riskyContainer = isDesktopRiskyLivenessContentType(contentType);
  const showDownloadFallback = playbackFailed || riskyContainer;

  useEffect(() => {
    setPlaybackFailed(false);
  }, [url, contentType]);

  const handlePlaybackError = useCallback((): void => {
    setPlaybackFailed(true);
  }, []);

  return (
    <div className="space-y-2">
      {!playbackFailed ? (
        <video
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-72 rounded-lg border border-charcoal-700 bg-charcoal-900"
          onError={handlePlaybackError}
        >
          {contentType ? (
            <source src={url} type={contentType} />
          ) : (
            <source src={url} />
          )}
          Your browser does not support video playback.
        </video>
      ) : null}

      {showDownloadFallback ? (
        <div className="space-y-1 rounded-lg border border-charcoal-700 bg-charcoal-900/60 p-3">
          <p className="text-sm text-charcoal-300">
            {playbackFailed
              ? "This browser cannot play the liveness video (often iPhone HEVC/MOV). Download it to review on a compatible player."
              : "This recording may not play in desktop Chrome/Firefox. Use download if the player stays blank."}
          </p>
          <a
            href={url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-primary-400 hover:underline"
          >
            Download video
          </a>
        </div>
      ) : (
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-primary-400 hover:underline"
        >
          Download video
        </a>
      )}
    </div>
  );
}
