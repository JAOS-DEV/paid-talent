"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import type { WorkerOwnedPhoto } from "@/lib/worker-dashboard";

interface PhotoStatusPillProps {
  photo: WorkerOwnedPhoto;
}

function statusId(photo: WorkerOwnedPhoto): string {
  if (photo.isCurrentApproved) return "primary";
  if (photo.moderationStatus === "pending") return "pending-review";
  if (photo.moderationStatus === "rejected") return "rejected";
  return "approved";
}

function pillVariant(
  photo: WorkerOwnedPhoto
): "success" | "warning" | "error" {
  if (photo.isCurrentApproved || photo.moderationStatus === "approved") {
    return "success";
  }
  if (photo.moderationStatus === "rejected") {
    return "error";
  }
  return "warning";
}

export function PhotoStatusPill({
  photo,
}: PhotoStatusPillProps): React.ReactElement {
  const t = useTranslations("gallery");
  const label = photo.isCurrentApproved
    ? t("statusPrimary")
    : photo.moderationStatus === "pending"
      ? t("statusPending")
      : photo.moderationStatus === "rejected"
        ? t("statusRejected")
        : t("statusApproved");

  return (
    <span data-testid={`photo-status-${statusId(photo)}`}>
      <Badge variant={pillVariant(photo)}>{label}</Badge>
    </span>
  );
}
