"use client";

import React from "react";
import { Badge } from "@/components/ui";
import { normalizeAvailability } from "@/lib/profile/availability";

interface AvailabilityBadgesProps {
  values: string[] | null | undefined;
  className?: string;
}

export function AvailabilityBadges({
  values,
  className = "",
}: AvailabilityBadgesProps): React.ReactElement | null {
  const options = normalizeAvailability(values);
  if (options.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {options.map((option) => (
        <Badge key={option}>{option}</Badge>
      ))}
    </div>
  );
}
