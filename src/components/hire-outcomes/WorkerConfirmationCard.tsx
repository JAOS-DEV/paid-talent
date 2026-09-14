"use client";

import React, { useCallback, useState } from "react";
import { Button, Card, CardContent } from "@/components/ui";
import {
  getWorkerConfirmationCopy,
  type ConfirmationRequestedStatus,
} from "@/lib/hire-outcomes/confirmations";

export interface WorkerConfirmationCardProps {
  requestId: string;
  venueName: string;
  openingContext?: string | null;
  requestedStatus: ConfirmationRequestedStatus;
  requestedAt?: string | Date | null;
  onResponded?: (action: "confirm" | "reject") => void;
}

export function getWorkerConfirmationEndpoint(
  requestId: string,
  action: "confirm" | "reject"
): string {
  return `/api/worker/hire-confirmations/${requestId}/${action}`;
}

export function WorkerConfirmationCard({
  requestId,
  venueName,
  openingContext = null,
  requestedStatus,
  requestedAt = null,
  onResponded,
}: WorkerConfirmationCardProps): React.ReactElement {
  const [loadingAction, setLoadingAction] = useState<"confirm" | "reject" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const copy = getWorkerConfirmationCopy(venueName, requestedStatus);
  const requestedDate = requestedAt
    ? new Date(requestedAt).toLocaleDateString()
    : null;

  const handleRespond = useCallback(
    async (action: "confirm" | "reject") => {
      setLoadingAction(action);
      setError(null);

      try {
        const response = await fetch(
          getWorkerConfirmationEndpoint(requestId, action),
          { method: "POST" }
        );
        const result = (await response.json()) as {
          success?: boolean;
          error?: string;
        };

        if (result.success) {
          onResponded?.(action);
        } else {
          setError(result.error ?? "Could not save your response");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoadingAction(null);
      }
    },
    [onResponded, requestId]
  );

  return (
    <Card padding="lg" className="border-gold-500/40 bg-gold-500/5">
      <CardContent>
        <div data-testid="hire-confirmation-card">
        <p className="text-gold-400 text-xs font-semibold uppercase tracking-wide mb-2">
          {copy.heading}
        </p>
        <h2 className="text-lg font-semibold text-charcoal-100 mb-1">
          {copy.statement}
        </h2>
        <p className="text-charcoal-400 text-sm mb-3">{copy.prompt}</p>
        {openingContext && (
          <p className="text-charcoal-300 text-sm mb-1">{openingContext}</p>
        )}
        {requestedDate && (
          <p className="text-charcoal-500 text-xs mb-4">
            Requested {requestedDate}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="gold"
            onClick={() => {
              void handleRespond("confirm");
            }}
            loading={loadingAction === "confirm"}
            disabled={loadingAction !== null}
          >
            {copy.confirmLabel}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void handleRespond("reject");
            }}
            loading={loadingAction === "reject"}
            disabled={loadingAction !== null}
          >
            {copy.rejectLabel}
          </Button>
        </div>
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
