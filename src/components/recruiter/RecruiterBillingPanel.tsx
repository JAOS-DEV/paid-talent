"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { RecruiterBillingView } from "@/lib/billing/summary";

interface RecruiterBillingPanelProps {
  summary: RecruiterBillingView;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RecruiterBillingPanel({
  summary,
}: RecruiterBillingPanelProps): React.ReactElement {
  const t = useTranslations("recruiter.billing");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async (): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { url?: string };
      if (!response.ok || !data.url) {
        setError(t("manageFailed"));
        setPending(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError(t("manageFailed"));
      setPending(false);
    }
  };

  const renewal =
    summary.showRenewal && summary.renewalAt
      ? formatDate(summary.renewalAt, locale)
      : null;
  const expiry =
    summary.showExpiry && summary.expiresAt
      ? formatDate(summary.expiresAt, locale)
      : null;

  return (
    <div className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-5 sm:p-6">
      <h1 className="text-2xl font-bold text-charcoal-100">{t("title")}</h1>
      <p className="mt-2 text-charcoal-400">{t("subtitle")}</p>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-charcoal-400">{t("currentPlan")}</dt>
          <dd className="text-right font-medium text-charcoal-100">
            {t(`plans.${summary.plan}`)}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-charcoal-400">{t("status")}</dt>
          <dd className="text-right font-medium text-charcoal-100">
            {t(`statuses.${summary.status}`)}
          </dd>
        </div>
        {renewal ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-charcoal-400">{t("renewal")}</dt>
            <dd className="text-right font-medium text-charcoal-100">{renewal}</dd>
          </div>
        ) : null}
        {expiry ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-charcoal-400">{t("expiry")}</dt>
            <dd className="text-right font-medium text-charcoal-100">{expiry}</dd>
          </div>
        ) : null}
        {summary.plan === "admin_grant" && !summary.showExpiry ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-charcoal-400">{t("expiry")}</dt>
            <dd className="text-right font-medium text-charcoal-100">{t("lifetime")}</dd>
          </div>
        ) : null}
      </dl>

      {summary.showSubscribe ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-charcoal-300">{t("noPlanBody")}</p>
          <Link href="/recruiter/upgrade" className="inline-flex w-full">
            <Button variant="gold" fullWidth>
              {t("pricingCta")}
            </Button>
          </Link>
        </div>
      ) : null}

      {summary.showManage ? (
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            fullWidth
            loading={pending}
            onClick={() => void openPortal()}
          >
            {t("manageOrCancel")}
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
