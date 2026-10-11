import React from "react";

interface DraftLegalBannerProps {
  label: string;
}

export function DraftLegalBanner({
  label,
}: DraftLegalBannerProps): React.ReactElement {
  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200"
    >
      {label}
    </div>
  );
}
