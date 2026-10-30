"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, OverflowMenu } from "@/components/ui";
import { ReportDialog } from "@/components/safety";
import { BlockAlertDialog } from "@/components/safety/BlockAlertDialog";
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
  const [blockOpen, setBlockOpen] = useState(false);

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
    setBusy("block");
    setError(null);
    try {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          request.conversationId
            ? { conversationId: request.conversationId }
            : { contactRequestId: request.id }
        ),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? t("errors.generic"));
        return;
      }
      setBlockOpen(false);
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-charcoal-100">
              {request.venue.name ?? t("inbox.unknownVenue")}
            </h3>
            <OverflowMenu
              label={t("inbox.more")}
              items={[
                {
                  id: "report",
                  label: t("inbox.report"),
                  onSelect: () => setReportOpen(true),
                  disabled: busy != null,
                },
                {
                  id: "block",
                  label: tSafety("blocks.block"),
                  onSelect: () => setBlockOpen(true),
                  disabled: busy != null,
                },
              ]}
            />
          </div>
          {request.openingSummary ? (
            <p className="mt-1 text-sm text-charcoal-300">
              {request.openingSummary}
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
        <div className="mt-4 flex flex-col gap-2">
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
        </div>
      ) : request.status === "accepted" && request.conversationId ? (
        <div className="mt-3">
          <Link
            href={`/worker/messages/${request.conversationId}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-400 hover:text-primary-300"
          >
            {t("sent.openChat")}
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-sm text-charcoal-300">
          {t(`status.${request.status}`)}
        </p>
      )}

      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <BlockAlertDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        busy={busy === "block"}
        onConfirm={() => void block()}
      />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitted={() => onChanged?.()}
        contactRequestId={request.id}
        conversationId={request.conversationId}
      />
    </article>
  );
}
