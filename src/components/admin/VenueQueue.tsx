"use client";

import React, { useCallback, useState } from "react";
import { Badge, Button, Card, CardContent, Input } from "@/components/ui";

export interface PendingVenue {
  id: string;
  name: string;
  area: string | null;
  subArea: string | null;
  venueLinkUrl: string;
  venueLinkKind: "google_maps" | "facebook" | "instagram";
  reviewStatus: string;
  reviewNote: string | null;
  createdAt: string;
  recruiterEmail: string | null;
  recruiterVerificationStatus: string | null;
  organizationName: string | null;
}

interface VenueQueueProps {
  initialVenues: PendingVenue[];
}

function kindLabel(kind: PendingVenue["venueLinkKind"]): string {
  switch (kind) {
    case "google_maps":
      return "Google Maps";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
  }
}

function VenueCard({
  venue,
  onResolved,
}: {
  venue: PendingVenue;
  onResolved: (id: string) => void;
}): React.ReactElement {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const review = useCallback(
    async (action: "approve" | "reject"): Promise<void> => {
      if (action === "reject" && !note.trim()) {
        setError("A note is required when rejecting");
        return;
      }
      setSubmitting(action);
      setError(null);
      try {
        const res = await fetch(`/api/admin/venues/${venue.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: note.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Review failed");
          setSubmitting(null);
          return;
        }
        onResolved(venue.id);
      } catch {
        setError("Something went wrong. Please try again.");
        setSubmitting(null);
      }
    },
    [note, onResolved, venue.id]
  );

  return (
    <Card padding="lg">
      <CardContent className="space-y-4 !p-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-charcoal-100">
              {venue.name}
            </h3>
            <p className="text-sm text-charcoal-400 mt-1">
              {venue.recruiterEmail ?? "Unknown recruiter"}
              {venue.organizationName
                ? ` · ${venue.organizationName}`
                : ""}
            </p>
            {(venue.area || venue.subArea) && (
              <p className="text-sm text-charcoal-500 mt-1">
                {[venue.area, venue.subArea].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">Pending review</Badge>
            <Badge variant="default">
              Identity: {venue.recruiterVerificationStatus ?? "unknown"}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-charcoal-700 bg-charcoal-900/50 p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-charcoal-500">
            Checklist
          </p>
          <ul className="text-sm text-charcoal-300 list-disc pl-5 space-y-1">
            <li>Link opens a real venue page ({kindLabel(venue.venueLinkKind)})</li>
            <li>Page matches the venue name / area claimed</li>
            <li>Not a personal profile or unrelated business</li>
          </ul>
          <a
            href={venue.venueLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-primary-400 hover:text-primary-300 underline-offset-2 hover:underline break-all"
          >
            Open {kindLabel(venue.venueLinkKind)} link
          </a>
        </div>

        <Input
          id={`venue-note-${venue.id}`}
          label="Review note (required to reject)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />

        {error ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            fullWidth
            loading={submitting === "approve"}
            disabled={submitting !== null}
            onClick={() => void review("approve")}
          >
            Approve
          </Button>
          <Button
            fullWidth
            variant="secondary"
            loading={submitting === "reject"}
            disabled={submitting !== null}
            onClick={() => void review("reject")}
            className="border-red-500/30 text-red-300 hover:bg-red-500/10"
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function VenueQueue({
  initialVenues,
}: VenueQueueProps): React.ReactElement {
  const [venues, setVenues] = useState(initialVenues);

  const onResolved = useCallback((id: string) => {
    setVenues((prev) => prev.filter((venue) => venue.id !== id));
  }, []);

  if (venues.length === 0) {
    return (
      <p className="text-sm text-charcoal-500">
        No venues awaiting review.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} onResolved={onResolved} />
      ))}
    </div>
  );
}
