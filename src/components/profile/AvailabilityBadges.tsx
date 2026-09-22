"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { normalizeAvailability } from "@/lib/profile/availability";
import {
  AVAILABILITY_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";

interface AvailabilityBadgesProps {
  values: string[] | null | undefined;
  className?: string;
}

export function AvailabilityBadges({
  values,
  className = "",
}: AvailabilityBadgesProps): React.ReactElement | null {
  const t = useTranslations("availability");
  const options = normalizeAvailability(values);
  if (options.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {options.map((option) => (
        <Badge key={option}>
          {translateCatalogValue(t, AVAILABILITY_MESSAGE_KEYS, option)}
        </Badge>
      ))}
    </div>
  );
}
