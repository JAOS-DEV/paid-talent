"use client";

import React, { useEffect, useState } from "react";
import { MessagingPausedBanner } from "./MessagingPausedBanner";

export function RecruiterMessagingPausedBanner(): React.ReactElement | null {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/recruiter/access");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setPaused(data.isPaused === true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <MessagingPausedBanner visible={paused} />;
}
