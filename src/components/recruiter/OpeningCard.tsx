"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  deleteOpening,
  publishOpening,
  unpublishOpening,
} from "@/lib/recruiter-profile/actions";
import type { RecruiterOpening } from "@/lib/db/schema";
import { formatOpeningPay } from "./format-pay";

interface OpeningCardProps {
  opening: RecruiterOpening;
}

export function OpeningCard({ opening }: OpeningCardProps): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "unpublish" | "delete" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const payLabel = formatOpeningPay({
    payMin: opening.payMin,
    payMax: opening.payMax,
    payCurrency: opening.payCurrency,
    payPeriod: opening.payPeriod,
  });

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
    <Card padding="lg" className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="break-words">{opening.role}</CardTitle>
          <p className="text-sm text-charcoal-400 mt-1 break-words">
            {opening.area}
          </p>
        </div>
        <Badge variant={opening.isPublished ? "success" : "warning"}>
          {opening.isPublished ? "Published" : "Draft"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {payLabel ? (
          <p className="text-sm text-charcoal-200">{payLabel}</p>
        ) : (
          <p className="text-sm text-charcoal-500">No pay range set</p>
        )}

        {opening.notes && (
          <p className="text-sm text-charcoal-400 line-clamp-3 break-words">
            {opening.notes}
          </p>
        )}

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        {confirmDelete ? (
          <div
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-3"
            role="alertdialog"
            aria-labelledby={`delete-title-${opening.id}`}
          >
            <div>
              <p
                id={`delete-title-${opening.id}`}
                className="font-medium text-red-200"
              >
                Delete this opening?
              </p>
              <p className="text-sm text-red-200/80 mt-1">
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
                className="border-red-500/40 text-red-200"
              >
                Delete opening
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href={`/recruiter/openings/${opening.id}/edit`}
              className="flex-1"
            >
              <Button variant="outline" fullWidth>
                Edit
              </Button>
            </Link>
            <Button
              variant={opening.isPublished ? "secondary" : "primary"}
              fullWidth
              className="flex-1"
              loading={busy === "publish" || busy === "unpublish"}
              onClick={() => void runPublishToggle()}
            >
              {opening.isPublished ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              className="flex-1"
              disabled={busy !== null}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
