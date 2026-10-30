"use client";

import React, { useEffect } from "react";
import Script from "next/script";
import { ADSENSE_CLIENT_ID, ADSENSE_ENABLED } from "./config";

interface AdSenseProps {
  adSlot: string;
  adFormat?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
}

export function AdSense({
  adSlot,
  adFormat = "auto",
  className = "",
}: AdSenseProps): React.ReactElement | null {
  useEffect(() => {
    if (ADSENSE_ENABLED && typeof window !== "undefined") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push(
          {}
        );
      } catch {
        console.log("[AdSense] Ad initialization error");
      }
    }
  }, []);

  if (!ADSENSE_ENABLED) {
    return null;
  }

  if (!ADSENSE_CLIENT_ID) {
    console.warn("[AdSense] Client ID not configured");
    return null;
  }

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export function AdSenseScript(): React.ReactElement | null {
  if (!ADSENSE_ENABLED || !ADSENSE_CLIENT_ID) {
    return null;
  }

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

