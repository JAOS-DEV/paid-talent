"use client";

import React, { useEffect } from "react";
import Script from "next/script";

interface AdSenseProps {
  adSlot: string;
  adFormat?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
}

const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

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
    return (
      <div
        className={`bg-charcoal-800 border border-charcoal-700 rounded-lg flex items-center justify-center text-charcoal-500 text-sm ${className}`}
        style={{ minHeight: "90px" }}
      >
        <span>Ad Placeholder</span>
      </div>
    );
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

export { ADSENSE_ENABLED, ADSENSE_CLIENT_ID };
