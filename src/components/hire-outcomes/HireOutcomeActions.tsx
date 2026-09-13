"use client";

import React, { useState, useCallback } from "react";
import type { HireOutcomeStatus } from "@/lib/db/schema";
import { Button } from "@/components/ui";
import {
  getNextAllowedStatus,
  isTerminalStatus,
} from "@/lib/hire-outcomes";

interface HireOutcomeActionsProps {
  interestId: string;
  currentStatus: HireOutcomeStatus;
  onStatusUpdated?: (newStatus: HireOutcomeStatus) => void;
  compact?: boolean;
}

async function updateHireOutcome(
  interestId: string,
  status: "hired" | "started"
): Promise<{ success: boolean; error?: string }> {
  const endpoint =
    status === "hired"
      ? "/api/recruiter/interests/mark-hired"
      : "/api/recruiter/interests/mark-started";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interestId }),
  });

  return response.json();
}

export function HireOutcomeActions({
  interestId,
  currentStatus,
  onStatusUpdated,
  compact = false,
}: HireOutcomeActionsProps): React.ReactElement | null {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = getNextAllowedStatus(currentStatus);
  const isTerminal = isTerminalStatus(currentStatus);

  const handleUpdateStatus = useCallback(async () => {
    if (!nextStatus || nextStatus === "interested") return;

    setLoading(true);
    setError(null);

    try {
      const result = await updateHireOutcome(
        interestId,
        nextStatus as "hired" | "started"
      );

      if (result.success) {
        onStatusUpdated?.(nextStatus);
      } else {
        setError(result.error ?? "Failed to update status");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [interestId, nextStatus, onStatusUpdated]);

  if (isTerminal) {
    return null;
  }

  const buttonLabel = nextStatus === "hired" ? "Mark Hired" : "Mark Started";
  const buttonVariant = nextStatus === "hired" ? "gold" : "primary";

  return (
    <div className={compact ? "" : "flex flex-col gap-2"}>
      <Button
        variant={buttonVariant}
        size={compact ? "sm" : "md"}
        onClick={handleUpdateStatus}
        loading={loading}
        disabled={loading}
      >
        {buttonLabel}
      </Button>
      {error && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}

export function getNextActionLabel(
  status: HireOutcomeStatus
): string | null {
  const nextStatus = getNextAllowedStatus(status);
  if (!nextStatus) return null;
  return nextStatus === "hired" ? "Mark Hired" : "Mark Started";
}
