"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { HireOutcomeStatus } from "@/lib/db/schema";
import { Badge } from "@/components/ui";

interface HireOutcomeStatusBadgeProps {
  status: HireOutcomeStatus;
  className?: string;
}

const statusConfig: Record<
  HireOutcomeStatus,
  { label: string; variant: "default" | "primary" | "gold" | "success" }
> = {
  interested: {
    label: "Interested",
    variant: "primary",
  },
  hired: {
    label: "Hired",
    variant: "gold",
  },
  started: {
    label: "Started",
    variant: "success",
  },
};

export function HireOutcomeStatusBadge({
  status,
  className = "",
}: HireOutcomeStatusBadgeProps): React.ReactElement {
  const t = useTranslations("recruiter.interests");
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {t(status)}
    </Badge>
  );
}

export function getStatusLabel(status: HireOutcomeStatus): string {
  return statusConfig[status].label;
}

export function getStatusVariant(
  status: HireOutcomeStatus
): "default" | "primary" | "gold" | "success" {
  return statusConfig[status].variant;
}
