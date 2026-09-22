"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Badge } from "@/components/ui";
import type { VerificationStatus } from "@/lib/db/schema";
import {
  isVerifiedLiveSuccessState,
  readVerifiedBannerDismissed,
  writeVerifiedBannerDismissed,
} from "@/lib/verification/banner-dismissal";

interface VerificationStatusBannerProps {
  status: VerificationStatus;
  isPublished: boolean;
  hasApprovedPrimaryPhoto?: boolean;
  userId?: string;
  onStartVerification?: () => void;
}

function getStatusConfig(
  status: VerificationStatus,
  isPublished: boolean,
  hasApprovedPrimaryPhoto: boolean,
  t: (key: string) => string
) {
  if (status === "verified" && isPublished && hasApprovedPrimaryPhoto) {
    return {
      type: "success" as const,
      icon: CheckCircleIcon,
      title: t("profileLiveVerified"),
      description: t("profileLiveVerifiedBody"),
      showAction: false,
    };
  }

  if (status === "verified" && !hasApprovedPrimaryPhoto) {
    return {
      type: "warning" as const,
      icon: AlertIcon,
      title: t("photoAwaiting"),
      description: t("photoAwaitingBody"),
      showAction: false,
    };
  }

  if (status === "verified" && !isPublished) {
    return {
      type: "warning" as const,
      icon: AlertIcon,
      title: t("notPublished"),
      description: t("notPublishedBody"),
      showAction: true,
      actionText: t("completeProfile"),
      actionHref: "/worker/onboarding",
    };
  }

  if (status === "pending") {
    return {
      type: "info" as const,
      icon: ClockIcon,
      title: t("pending"),
      description: t("pendingBody"),
      showAction: false,
    };
  }

  if (status === "rejected") {
    return {
      type: "error" as const,
      icon: XCircleIcon,
      title: t("rejected"),
      description: t("rejectedBody"),
      showAction: true,
      actionText: t("resubmit"),
      actionHref: "/worker/verification",
    };
  }

  return {
    type: "warning" as const,
    icon: ShieldIcon,
    title: t("required"),
    description: t("requiredBody"),
    showAction: true,
    actionText: t("start"),
    actionHref: "/worker/verification",
  };
}

function CheckCircleIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ShieldIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function subscribeBannerStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

const typeStyles = {
  success: {
    container: "bg-green-500/10 border-green-500/30",
    icon: "text-green-400",
    title: "text-green-300",
    description: "text-green-200/70",
  },
  warning: {
    container: "bg-yellow-500/10 border-yellow-500/30",
    icon: "text-yellow-400",
    title: "text-yellow-300",
    description: "text-yellow-200/70",
  },
  error: {
    container: "bg-red-500/10 border-red-500/30",
    icon: "text-red-400",
    title: "text-red-300",
    description: "text-red-200/70",
  },
  info: {
    container: "bg-blue-500/10 border-blue-500/30",
    icon: "text-blue-400",
    title: "text-blue-300",
    description: "text-blue-200/70",
  },
};

export function VerificationStatusBanner({
  status,
  isPublished,
  hasApprovedPrimaryPhoto = false,
  userId,
}: VerificationStatusBannerProps): React.ReactElement {
  const t = useTranslations("worker.verificationBanner");
  const isSuccess = isVerifiedLiveSuccessState(
    status,
    isPublished,
    hasApprovedPrimaryPhoto
  );
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const storedDismissed = useSyncExternalStore(
    subscribeBannerStorage,
    () =>
      isSuccess && userId ? readVerifiedBannerDismissed(userId) : false,
    () => false
  );
  const dismissed = isSuccess && (dismissedThisSession || storedDismissed);

  function handleDismiss(): void {
    if (!userId) return;
    writeVerifiedBannerDismissed(userId);
    setDismissedThisSession(true);
  }

  if (isSuccess && dismissed) {
    return (
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="verified-live-compact"
      >
        <Badge variant="success">{t("verified")}</Badge>
        <span className="text-sm text-charcoal-400">{t("profileLive")}</span>
      </div>
    );
  }

  const config = getStatusConfig(status, isPublished, hasApprovedPrimaryPhoto, t);
  const styles = typeStyles[config.type];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border p-4 ${styles.container}`}
      data-testid={isSuccess ? "verified-live-banner" : "verification-status-banner"}
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          <Icon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${styles.title}`}>{config.title}</h3>
            {status !== "verified" && (
              <Badge variant={status === "pending" ? "warning" : status === "rejected" ? "error" : "default"}>
                {t("notLive")}
              </Badge>
            )}
          </div>
          <p className={`text-sm ${styles.description}`}>{config.description}</p>
          {config.showAction && config.actionHref && (
            <div className="mt-3">
              <Link href={config.actionHref}>
                <Button size="sm" variant={config.type === "error" ? "primary" : "outline"}>
                  {config.actionText}
                </Button>
              </Link>
            </div>
          )}
        </div>
        {isSuccess ? (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 min-h-11 min-w-11 rounded-lg text-charcoal-400 hover:text-charcoal-100 hover:bg-charcoal-800 flex items-center justify-center"
            aria-label={t("dismiss")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function VerificationStatusBadge({
  status,
}: {
  status: VerificationStatus;
}): React.ReactElement {
  const t = useTranslations("worker.verificationBanner");
  switch (status) {
    case "verified":
      return <Badge variant="success">{t("verified")}</Badge>;
    case "pending":
      return <Badge variant="warning">{t("pendingReview")}</Badge>;
    case "rejected":
      return <Badge variant="error">{t("rejectedBadge")}</Badge>;
    default:
      return <Badge variant="default">{t("notVerified")}</Badge>;
  }
}
