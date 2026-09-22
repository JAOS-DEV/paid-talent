import React from "react";

interface VenueLogoProps {
  logoUrl: string | null;
  name: string;
  size?: "sm" | "md";
}

const SIZE_CLASS: Record<NonNullable<VenueLogoProps["size"]>, string> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
};

function logoAlt(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${trimmed} logo` : "Venue logo";
}

export function VenueLogo({
  logoUrl,
  name,
  size = "md",
}: VenueLogoProps): React.ReactElement | null {
  if (!logoUrl) return null;

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden rounded-full border border-charcoal-700 bg-charcoal-800 ${SIZE_CLASS[size]}`}
    >
      {/* CDN/R2 hosts are not configured as next/image remote patterns. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={logoAlt(name)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
