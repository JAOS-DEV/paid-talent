"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import {
  deleteOpening,
  publishOpening,
  unpublishOpening,
} from "@/lib/recruiter-profile/actions";
import type { RecruiterOpening } from "@/lib/db/schema";
import { VenueLogo } from "@/components/media/VenueLogo";
import { formatOpeningPay } from "./format-pay";

interface OpeningCardProps {
  opening: RecruiterOpening;
  venueLogoUrl?: string | null;
  venueName?: string | null;
}

function ChevronRightIcon(): React.ReactElement {
  return (
    <svg
      className="w-5 h-5 text-charcoal-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function OpeningCard({
  opening,
  venueLogoUrl = null,
  venueName = null,
}: OpeningCardProps): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "unpublish" | "delete" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const payLabel = formatOpeningPay(opening);

  const runPublishToggle = async (): Promise<void> => {
    setError(null);
    if (opening.isPublished) {
      setBusy("unpublish");
      const result = await unpublishOpening(opening.id);
      setBusy(null);
      if (!result.success) {
        setError(result.error || "Failed to unpublish");
        return;
      }
    } else {
      setBusy("publish");
      const result = await publishOpening(opening.id);
      setBusy(null);
      if (!result.success) {
        setError(result.error || "Failed to publish");
        return;
      }
    }
    router.refresh();
  };

  const runDelete = async (): Promise<void> => {
    setBusy("delete");
    setError(null);
    const result = await deleteOpening(opening.id);
    setBusy(null);
    if (!result.success) {
      setError(result.error || "Failed to delete");
      setConfirmDelete(false);
      return;
    }
    router.refresh();
  };

  return (
    <Card padding="none" className="min-w-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-charcoal-800/50 transition-colors rounded-xl"
      >
        <VenueLogo
          logoUrl={venueLogoUrl}
          name={venueName || opening.role}
          size="sm"
        />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-charcoal-100 break-words">
              {opening.role}
            </h3>
            <Badge
              variant={opening.isPublished ? "success" : "warning"}
              className="text-xs"
            >
              {opening.isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-xs">
              {opening.area}
            </Badge>
            {payLabel ? (
              <span className="text-lg font-bold text-primary-400">
                {payLabel}
              </span>
            ) : (
              <span className="text-sm text-charcoal-500">No pay set</span>
            )}
          </div>
          {opening.notes && (
            <p className="text-sm text-charcoal-500 line-clamp-2 break-words">
              {opening.notes}
            </p>
          )}
        </div>
        <div
          className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          <ChevronRightIcon />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-charcoal-700 pt-3">
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          {confirmDelete ? (
            <div
              className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3"
              role="alertdialog"
              aria-labelledby={`delete-title-${opening.id}`}
            >
              <div>
                <p
                  id={`delete-title-${opening.id}`}
                  className="font-medium text-red-300"
                >
                  Delete this opening?
                </p>
                <p className="text-sm text-charcoal-400 mt-1">
                  This removes the opening from your venue. Existing interests
                  will remain, but will no longer be linked to this opening.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  fullWidth
                  disabled={busy !== null}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  loading={busy === "delete"}
                  onClick={() => void runDelete()}
                  className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                >
                  Delete opening
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href={`/recruiter/openings/${opening.id}/edit`}>
                <Button variant="outline" fullWidth>
                  Edit opening
                </Button>
              </Link>
              <Button
                variant={opening.isPublished ? "secondary" : "primary"}
                fullWidth
                loading={busy === "publish" || busy === "unpublish"}
                onClick={() => void runPublishToggle()}
              >
                {opening.isPublished ? "Unpublish" : "Publish opening"}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                disabled={busy !== null}
                onClick={() => setConfirmDelete(true)}
                className="text-charcoal-400 hover:text-red-300"
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
