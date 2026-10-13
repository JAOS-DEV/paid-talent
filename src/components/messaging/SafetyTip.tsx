"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface SafetyTipProps {
  variant: "banner" | "inline";
}

export function SafetyTip({ variant }: SafetyTipProps): React.ReactElement {
  const t = useTranslations("messaging");

  if (variant === "inline") {
    return (
      <p className="text-xs text-amber-400/90" data-testid="safety-inline">
        {t("safety.permanentLine")}
      </p>
    );
  }

  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
      role="status"
      data-testid="safety-banner"
    >
      {t("safety.banner")}
    </div>
  );
}
