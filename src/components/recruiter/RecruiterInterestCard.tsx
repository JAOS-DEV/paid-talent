"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";
import {
  HireOutcomeStatusBadge,
  HireOutcomeActions,
} from "@/components/hire-outcomes";
import type {
  HireConfirmationRequestStatus,
  HireConfirmationRequestedStatus,
  HireOutcomeStatus,
} from "@/lib/db/schema";

export interface RecruiterInterestCardData {
  id: string;
  workerProfileId: string;
  workerName: string;
  workerPhoto: string | null;
  message: string | null;
  createdAt: string;
  hireOutcome: {
    id: string;
    status: HireOutcomeStatus;
    hiredAt: string | null;
    startedAt: string | null;
    notes: string | null;
  } | null;
  confirmationRequest: {
    id: string;
    requestedStatus: HireConfirmationRequestedStatus;
    requestStatus: HireConfirmationRequestStatus;
    requestedAt: string;
  } | null;
}

function getEffectiveStatus(
  interest: RecruiterInterestCardData
): HireOutcomeStatus {
  return interest.hireOutcome?.status ?? "interested";
}

export function RecruiterInterestCard({
  interest,
  onRequestCreated,
}: {
  interest: RecruiterInterestCardData;
  onRequestCreated: (
    interestId: string,
    requestedStatus: HireConfirmationRequestedStatus
  ) => void;
}): React.ReactElement {
  const effectiveStatus = getEffectiveStatus(interest);
  const createdDate = new Date(interest.createdAt).toLocaleDateString();

  const handleRequestCreated = useCallback(
    (requestedStatus: HireConfirmationRequestedStatus) => {
      onRequestCreated(interest.id, requestedStatus);
    },
    [interest.id, onRequestCreated]
  );

  return (
    <div data-testid="interest-card" data-worker-name={interest.workerName}>
      <Card padding="md" className="hover:border-charcoal-600 transition-colors">
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-start min-w-0">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <Link
                href={`/recruiter/profile/${interest.workerProfileId}`}
                className="flex-shrink-0"
              >
                {interest.workerPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- CDN/R2 URLs are not next/image remotePatterns
                  <img
                    src={interest.workerPhoto}
                    alt={interest.workerName}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-charcoal-700 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-charcoal-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Link
                    href={`/recruiter/profile/${interest.workerProfileId}`}
                    className="text-charcoal-100 font-medium hover:text-primary-400 break-words"
                  >
                    {interest.workerName}
                  </Link>
                  <HireOutcomeStatusBadge status={effectiveStatus} />
                </div>

                <p className="text-charcoal-500 text-sm mb-2">
                  Interested on {createdDate}
                </p>

                {interest.message && (
                  <p className="text-charcoal-400 text-sm line-clamp-2 mb-3 break-words">
                    {interest.message}
                  </p>
                )}

                {interest.hireOutcome?.hiredAt && (
                  <p className="text-charcoal-500 text-xs">
                    Hired:{" "}
                    {new Date(interest.hireOutcome.hiredAt).toLocaleDateString()}
                  </p>
                )}
                {interest.hireOutcome?.startedAt && (
                  <p className="text-charcoal-500 text-xs">
                    Started:{" "}
                    {new Date(
                      interest.hireOutcome.startedAt
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full min-w-0 md:w-auto md:flex-shrink-0 md:items-end">
              <HireOutcomeActions
                interestId={interest.id}
                currentStatus={effectiveStatus}
                confirmationRequest={interest.confirmationRequest}
                onRequestCreated={handleRequestCreated}
                compact
              />
              <Link
                href={`/recruiter/profile/${interest.workerProfileId}`}
                className="w-full md:w-auto"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto min-h-11"
                >
                  View Profile
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
