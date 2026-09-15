"use client";

import React, { useState, useCallback } from "react";
import type {
  HireConfirmationRequestStatus,
  HireConfirmationRequestedStatus,
  HireOutcomeStatus,
} from "@/lib/db/schema";
import { Button } from "@/components/ui";
import {
  getRecruiterPendingLabel,
  getRecruiterRejectionLabel,
  getRecruiterRequestAction,
  getRecruiterRequestButtonLabel,
} from "@/lib/hire-outcomes/confirmations";

export interface ConfirmationRequestState {
  requestedStatus: HireConfirmationRequestedStatus;
  requestStatus: HireConfirmationRequestStatus;
}

interface HireOutcomeActionsProps {
  interestId: string;
  currentStatus: HireOutcomeStatus;
  confirmationRequest?: ConfirmationRequestState | null;
  onRequestCreated?: (requestedStatus: HireConfirmationRequestedStatus) => void;
  compact?: boolean;
}

async function requestConfirmation(
  interestId: string,
  requestedStatus: "hired" | "started"
): Promise<{ success: boolean; error?: string }> {
  const endpoint =
    requestedStatus === "hired"
      ? "/api/recruiter/interests/request-hire"
      : "/api/recruiter/interests/request-start";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interestId }),
  });

  return response.json();
}

export function getHireConfirmationEndpoint(
  requestedStatus: "hired" | "started"
): string {
  return requestedStatus === "hired"
    ? "/api/recruiter/interests/request-hire"
    : "/api/recruiter/interests/request-start";
}

export function HireOutcomeActions({
  interestId,
  currentStatus,
  confirmationRequest = null,
  onRequestCreated,
  compact = false,
}: HireOutcomeActionsProps): React.ReactElement | null {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingRequestedStatus =
    confirmationRequest?.requestStatus === "pending"
      ? confirmationRequest.requestedStatus
      : null;
  const rejectedRequestedStatus =
    confirmationRequest?.requestStatus === "rejected"
      ? confirmationRequest.requestedStatus
      : null;

  const action = getRecruiterRequestAction(
    currentStatus,
    pendingRequestedStatus
  );
  const buttonLabel = getRecruiterRequestButtonLabel(action);
  const pendingLabel = getRecruiterPendingLabel(pendingRequestedStatus);
  const rejectionLabel = getRecruiterRejectionLabel(rejectedRequestedStatus);

  const handleRequest = useCallback(async () => {
    if (!action) return;
    const requestedStatus = action === "request-hire" ? "hired" : "started";

    setLoading(true);
    setError(null);

    try {
      const result = await requestConfirmation(interestId, requestedStatus);

      if (result.success) {
        onRequestCreated?.(requestedStatus);
      } else {
        setError(result.error ?? "Failed to request confirmation");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [action, interestId, onRequestCreated]);

  if (!action && !pendingLabel && !rejectionLabel) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-1 w-full items-stretch md:w-auto md:items-end"
          : "flex flex-col gap-2"
      }
    >
      {pendingLabel && (
        <p className="text-gold-400 text-xs font-medium">{pendingLabel}</p>
      )}
      {rejectionLabel && !pendingLabel && (
        <p className="text-charcoal-400 text-xs">{rejectionLabel}</p>
      )}
      {buttonLabel && (
        <Button
          variant={action === "request-hire" ? "gold" : "primary"}
          size={compact ? "sm" : "md"}
          className={compact ? "w-full md:w-auto min-h-11 px-3 text-center" : ""}
          onClick={() => {
            void handleRequest();
          }}
          loading={loading}
          disabled={loading}
        >
          {buttonLabel}
        </Button>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export function getNextActionLabel(
  status: HireOutcomeStatus,
  pendingRequestedStatus: HireConfirmationRequestedStatus | null = null
): string | null {
  return getRecruiterRequestButtonLabel(
    getRecruiterRequestAction(status, pendingRequestedStatus)
  );
}
