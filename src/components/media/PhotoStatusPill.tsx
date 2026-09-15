"use client";

import React from "react";
import { Badge } from "@/components/ui";
import type { WorkerOwnedPhoto } from "@/lib/worker-dashboard";

interface PhotoStatusPillProps {
  photo: WorkerOwnedPhoto;
}

export function photoStatusLabel(photo: WorkerOwnedPhoto): string {
  if (photo.isCurrentApproved) return "Primary";
  if (photo.moderationStatus === "pending") return "Pending review";
  if (photo.moderationStatus === "rejected") return "Rejected";
  return "Approved";
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
  const label = photoStatusLabel(photo);
  return (
    <span data-testid={`photo-status-${label.replace(/\s+/g, "-").toLowerCase()}`}>
      <Badge variant={pillVariant(photo)}>{label}</Badge>
    </span>
  );
}
