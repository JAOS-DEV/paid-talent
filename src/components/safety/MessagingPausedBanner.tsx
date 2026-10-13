"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface MessagingPausedBannerProps {
  visible: boolean;
}

export function MessagingPausedBanner({
  visible,
}: MessagingPausedBannerProps): React.ReactElement | null {
  const t = useTranslations("safety");

  if (!visible) {
    return null;
  }

  return (
    <p
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
      data-testid="messaging-paused-banner"
      role="status"
    >
      {t("messagingPaused")}
    </p>
  );
}
