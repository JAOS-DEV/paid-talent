"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, RadioGroup, RadioGroupItem, Textarea } from "@/components/ui";

const REASON_KEYS = [
  "scam_or_fake_job",
  "asked_for_money",
  "asked_for_documents",
  "harassment",
  "sexual_content",
  "underage_concern",
  "trafficking_concern",
  "spam",
  "other",
] as const;

export type ReportReasonKey = (typeof REASON_KEYS)[number];

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  contactRequestId?: string | null;
  conversationId?: string | null;
  reportedWorkerProfileId?: string | null;
  reportedVenueId?: string | null;
}

export function ReportDialog({
  open,
  onClose,
  onSubmitted,
  contactRequestId,
  conversationId,
  reportedWorkerProfileId,
  reportedVenueId,
}: ReportDialogProps): React.ReactElement | null {
  const t = useTranslations("safety.report");
  const [reason, setReason] = useState<ReportReasonKey | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) {
    return null;
  }

  const resetAndClose = (): void => {
    setReason("");
    setDetails("");
    setError(null);
    setDone(false);
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!reason) {
      setError(t("reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          details: details.trim() || null,
          contactRequestId: contactRequestId ?? null,
          conversationId: conversationId ?? null,
          reportedWorkerProfileId: reportedWorkerProfileId ?? null,
          reportedVenueId: reportedVenueId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("submitFailed"));
        return;
      }
      setDone(true);
      onSubmitted?.();
    } catch {
      setError(t("submitFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
      data-testid="report-dialog"
    >
      <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
        {done ? (
          <>
            <h2
              id="report-dialog-title"
              className="text-lg font-semibold text-charcoal-100"
            >
              {t("thanksTitle")}
            </h2>
            <p className="mt-3 text-sm text-charcoal-300" data-testid="report-thanks">
              {t("thanks")}
            </p>
            <Button
              type="button"
              variant="primary"
              fullWidth
              className="mt-5"
              onClick={resetAndClose}
            >
              {t("close")}
            </Button>
          </>
        ) : (
          <>
            <h2
              id="report-dialog-title"
              className="text-lg font-semibold text-charcoal-100"
            >
              {t("title")}
            </h2>
            <p className="mt-2 text-sm text-charcoal-400">{t("description")}</p>

            <RadioGroup
              className="mt-4 space-y-3"
              value={reason || undefined}
              onValueChange={(value) => setReason(value as ReportReasonKey)}
              aria-label={t("reasonLegend")}
            >
              {REASON_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer gap-3 rounded-lg border border-charcoal-700 p-3 hover:bg-charcoal-800/60"
                >
                  <RadioGroupItem
                    value={key}
                    className="mt-1"
                    data-testid={`report-reason-${key}`}
                  />
                  <span>
                    <span className="block text-sm font-medium text-charcoal-100">
                      {t(`reasons.${key}`)}
                    </span>
                    <span className="mt-0.5 block text-xs text-charcoal-400">
                      {t(`reasonHelp.${key}`)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>

            <div className="mt-4">
              <Textarea
                label={t("detailsLabel")}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
              />
            </div>

            {error ? (
              <p className="mt-2 text-sm text-error" data-testid="report-error">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="button"
                variant="primary"
                fullWidth
                loading={busy}
                disabled={busy}
                onClick={() => void submit()}
                data-testid="report-submit"
              >
                {t("submit")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={resetAndClose}
              >
                {t("cancel")}
              </Button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

export { REASON_KEYS };
