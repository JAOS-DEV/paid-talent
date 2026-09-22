import React from "react";

interface VenueAvatarProps {
  venueName: string;
  logoUrl: string | null;
  size?: "md" | "lg";
}

const sizeClass: Record<NonNullable<VenueAvatarProps["size"]>, string> = {
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-xl",
};

export function VenueAvatar({
  venueName,
  logoUrl,
  size = "md",
}: VenueAvatarProps): React.ReactElement {
  const dimension = sizeClass[size];

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- recruiter logo URLs are not next/image remotePatterns
      <img
        src={logoUrl}
        alt={`${venueName} logo`}
        className={`${dimension} rounded-full object-cover bg-charcoal-800 flex-shrink-0`}
      />
    );
  }

  const initial = venueName.trim().charAt(0).toUpperCase() || "V";

  return (
    <div
      className={`${dimension} rounded-full bg-charcoal-800 text-primary-400 font-semibold flex items-center justify-center flex-shrink-0`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
