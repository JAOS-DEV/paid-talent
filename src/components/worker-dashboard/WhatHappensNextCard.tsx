"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent } from "@/components/ui";
import type { VerificationStatus } from "@/lib/db/schema";
import {
  getWorkerDashboardProfileAction,
} from "@/lib/helpers/worker-dashboard-access";
import type { ProfileCompleteness } from "@/lib/profile";
import type { WorkerDashboardPhotoSlots } from "@/lib/worker-dashboard/types";
import {
  readWhatHappensNextDismissed,
  shouldShowWhatHappensNext,
  workerHasPublishedContact,
  writeWhatHappensNextDismissed,
} from "@/lib/worker-dashboard/what-happens-next-dismissal";

interface WhatHappensNextCardProps {
  userId: string;
  completeness: ProfileCompleteness;
  photoSlots: WorkerDashboardPhotoSlots;
  verificationStatus: VerificationStatus;
  profile: {
    lineId?: string | null;
    whatsappNumber?: string | null;
    phoneNumber?: string | null;
  } | null;
}

function subscribeWhatHappensNextStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

function verificationStatusLabelKey(
  status: VerificationStatus
):
  | "step3StatusVerified"
  | "step3StatusPending"
  | "step3StatusRejected"
  | "step3StatusUnverified" {
  switch (status) {
    case "verified":
      return "step3StatusVerified";
    case "pending":
      return "step3StatusPending";
    case "rejected":
      return "step3StatusRejected";
    default:
      return "step3StatusUnverified";
  }
}

export function WhatHappensNextCard({
  userId,
  completeness,
  photoSlots,
  verificationStatus,
  profile,
}: WhatHappensNextCardProps): React.ReactElement | null {
  const t = useTranslations("worker.dashboard.whatHappensNext");
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const storedDismissed = useSyncExternalStore(
    subscribeWhatHappensNextStorage,
    () => (userId ? readWhatHappensNextDismissed(userId) : false),
    () => false
  );
  const dismissed = dismissedThisSession || storedDismissed;

  if (!shouldShowWhatHappensNext(userId, dismissed)) {
    return null;
  }

  const profileAction = getWorkerDashboardProfileAction(completeness);
  const hasContact = workerHasPublishedContact(profile);
  const statusLabel = t(verificationStatusLabelKey(verificationStatus));
  const verificationCta =
    verificationStatus === "unverified" ? t("step3Cta") : t("step3CtaPending");

  function handleDismiss(): void {
    writeWhatHappensNextDismissed(userId);
    setDismissedThisSession(true);
  }

  return (
    <div className="mb-6" data-testid="what-happens-next-card">
      <Card padding="lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-charcoal-100">{t("title")}</h2>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 min-h-11 min-w-11 rounded-lg text-charcoal-400 hover:text-charcoal-100 hover:bg-charcoal-800 flex items-center justify-center"
            aria-label={t("dismiss")}
            data-testid="what-happens-next-dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <CardContent className="!p-0 space-y-5">
          <ol className="space-y-5 list-none">
            <li data-testid="what-happens-next-step-1">
              <p className="text-sm font-medium text-charcoal-100">
                1. {t("step1Title")}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                {t("step1Body", { progress: completeness.progress })}
              </p>
              <Link
                href={profileAction.href}
                className="inline-block mt-2 text-sm text-primary-400 hover:text-primary-300"
              >
                {completeness.isComplete ? t("step1Cta") : t("step1CtaComplete")}
              </Link>
            </li>

            <li data-testid="what-happens-next-step-2">
              <p className="text-sm font-medium text-charcoal-100">
                2. {t("step2Title")}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                {t("step2Body", {
                  approved: photoSlots.approvedCount,
                  max: photoSlots.maxSlots,
                })}
              </p>
              <Link
                href="/worker/profile"
                className="inline-block mt-2 text-sm text-primary-400 hover:text-primary-300"
              >
                {t("step2Cta")}
              </Link>
            </li>

            <li data-testid="what-happens-next-step-3">
              <p className="text-sm font-medium text-charcoal-100">
                3. {t("step3Title")}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">{t("step3Body")}</p>
              <p
                className="text-sm text-charcoal-300 mt-1"
                data-testid="what-happens-next-verification-status"
              >
                {t("step3Status", { status: statusLabel })}
              </p>
              <Link
                href="/worker/verification"
                className="inline-block mt-2 text-sm text-primary-400 hover:text-primary-300"
              >
                {verificationCta}
              </Link>
            </li>

            <li data-testid="what-happens-next-step-4">
              <p className="text-sm font-medium text-charcoal-100">
                4. {t("step4Title")}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">{t("step4Body")}</p>
              {!hasContact ? (
                <>
                  <p
                    className="text-sm text-yellow-300/90 mt-2"
                    data-testid="what-happens-next-contact-nudge"
                  >
                    {t("step4AddContact")}
                  </p>
                  <Link href="/worker/profile" className="inline-block mt-2">
                    <Button size="sm" variant="outline">
                      {t("step4Cta")}
                    </Button>
                  </Link>
                </>
              ) : (
                <Link
                  href="/worker/interests"
                  className="inline-block mt-2 text-sm text-primary-400 hover:text-primary-300"
                >
                  {t("step4ViewInterests")}
                </Link>
              )}
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
