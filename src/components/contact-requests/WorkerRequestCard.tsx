"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Badge } from "@/components/ui";
import { ReportDialog } from "@/components/safety";
import type { InboxContactRequestDto } from "@/lib/contact-requests/queries";

interface WorkerRequestCardProps {
  request: InboxContactRequestDto;
  onChanged?: () => void;
}

export function WorkerRequestCard({
  request,
  onChanged,
}: WorkerRequestCardProps): React.ReactElement {
  const t = useTranslations("contactRequests");
  const tSafety = useTranslations("safety");
  const [busy, setBusy] = useState<"accept" | "decline" | "block" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const act = async (action: "accept" | "decline"): Promise<void> => {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(
        `/api/contact-requests/${request.id}/${action}`,
        { method: "POST" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? t("errors.generic"));
        return;
      }
      onChanged?.();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  };

  const block = async (): Promise<void> => {
    if (!window.confirm(tSafety("blocks.confirm"))) {
      return;
    }
    setBusy("block");
    setError(null);
    try {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: request.recruiterUserId,
          conversationId: request.conversationId,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? t("errors.generic"));
        return;
      }
      onChanged?.();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-4">
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-charcoal-800">
          {request.venue.logoUrl ? (
            <Image
              src={request.venue.logoUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-charcoal-100">
              {request.venue.name ?? t("inbox.unknownVenue")}
            </h3>
            {request.isPro ? (
              <span data-testid="verified-pro-badge">
                <Badge variant="gold">{t("inbox.verifiedPro")}</Badge>
              </span>
            ) : null}
          </div>
          {request.openingSummary ? (
            <p className="mt-1 text-sm text-charcoal-400">
              {request.openingSummary}
            </p>
          ) : null}
          {request.recruiterFirstName ? (
            <p className="mt-1 text-xs text-charcoal-500">
              {t("inbox.from", { name: request.recruiterFirstName })}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-charcoal-200">
        {request.openerText}
      </p>
      {request.followUpText ? (
        <p className="mt-2 whitespace-pre-wrap border-l-2 border-charcoal-600 pl-3 text-sm text-charcoal-300">
          {request.followUpText}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-amber-400/90">{t("inbox.safetyLine")}</p>

      {request.status === "pending" ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="primary"
            fullWidth
            disabled={busy != null}
            onClick={() => void act("accept")}
          >
            {busy === "accept" ? t("inbox.accepting") : t("inbox.accept")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={busy != null}
            onClick={() => void act("decline")}
          >
            {busy === "decline" ? t("inbox.declining") : t("inbox.decline")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={busy != null}
            onClick={() => setReportOpen(true)}
          >
            {t("inbox.report")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={busy != null}
            onClick={() => void block()}
          >
            {tSafety("blocks.block")}
          </Button>
        </div>
      ) : request.status === "accepted" && request.conversationId ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={`/worker/messages/${request.conversationId}`}
            className="inline-flex text-sm font-medium text-primary-400 hover:text-primary-300"
          >
            {t("sent.openChat")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReportOpen(true)}
          >
            {t("inbox.report")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-charcoal-500">
            {t(`status.${request.status}`)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReportOpen(true)}
          >
            {t("inbox.report")}
          </Button>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitted={() => onChanged?.()}
        contactRequestId={request.id}
        conversationId={request.conversationId}
        reportedUserId={request.recruiterUserId}
      />
    </article>
  );
}
