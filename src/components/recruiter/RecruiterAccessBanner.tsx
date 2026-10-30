"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { RecruiterAccessDto } from "@/lib/recruiter-access";
import type { VerificationStatus } from "@/lib/db/schema";
import { isUserRejectionReasonCode } from "@/lib/verification/rejection-reasons";

interface VenueRow {
  reviewStatus: string;
  reviewNote: string | null;
  archivedAt: string | null;
}

type BannerTone = "info" | "warning" | "error" | "success";

const toneClass: Record<BannerTone, { box: string; title: string; body: string }> = {
  info: {
    box: "border-primary-500/30 bg-primary-500/10",
    title: "text-primary-200",
    body: "text-charcoal-200",
  },
  warning: {
    box: "border-warning/40 bg-warning/10",
    title: "text-warning",
    body: "text-charcoal-200",
  },
  error: {
    box: "border-error/40 bg-error/10",
    title: "text-error",
    body: "text-charcoal-200",
  },
  success: {
    box: "border-success/40 bg-success/10",
    title: "text-success",
    body: "text-charcoal-200",
  },
};

export function RecruiterAccessBanner(): React.ReactElement | null {
  const t = useTranslations("recruiter.accessBanner");
  const reasonT = useTranslations("verification.rejectionReasons");
  const [access, setAccess] = useState<RecruiterAccessDto | null>(null);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [rejectionReasonCode, setRejectionReasonCode] = useState<string | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [accessRes, venuesRes, verificationRes] = await Promise.all([
          fetch("/api/recruiter/access"),
          fetch("/api/recruiter/venues"),
          fetch("/api/recruiter/verification"),
        ]);
        if (cancelled) {
          return;
        }
        if (accessRes.ok) {
          setAccess((await accessRes.json()) as RecruiterAccessDto);
        }
        if (venuesRes.ok) {
          const data = (await venuesRes.json()) as { venues?: VenueRow[] };
          setVenues(data.venues ?? []);
        }
        if (verificationRes.ok) {
          const data = (await verificationRes.json()) as {
            verification?: {
              verificationStatus?: VerificationStatus;
              rejectionReasonCode?: string | null;
            };
          };
          setRejectionReasonCode(
            data.verification?.rejectionReasonCode?.trim() || null
          );
        }
      } catch {
        // Leave the banner hidden when the status cannot be loaded.
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !access) {
    return null;
  }

  const activeVenues = venues.filter((venue) => !venue.archivedAt);
  const venuePending = activeVenues.some(
    (venue) => venue.reviewStatus === "pending"
  );
  const rejectedVenue = activeVenues.find(
    (venue) => venue.reviewStatus === "rejected"
  );
  const subscribed =
    access.tier === "pro" || access.canViewTopTalentFull === true;

  let tone: BannerTone = "warning";
  let title = t("unverifiedTitle");
  let body = t("unverifiedBody");
  let action: { href: string; label: string } | null = {
    href: "/recruiter/verification",
    label: t("verifyCta"),
  };

  if (access.identityStatus === "pending") {
    tone = "info";
    title = t("underReviewTitle");
    body = t("underReviewBody");
    action = null;
  } else if (access.identityStatus === "rejected") {
    tone = "error";
    title = t("rejectedTitle");
    body = isUserRejectionReasonCode(rejectionReasonCode)
      ? reasonT(rejectionReasonCode)
      : t("rejectedBody");
    action = { href: "/recruiter/verification", label: t("tryAgain") };
  } else if (access.identityStatus !== "verified") {
    tone = "warning";
    title = t("unverifiedTitle");
    body = t("unverifiedBody");
    action = { href: "/recruiter/verification", label: t("verifyCta") };
  } else if (!access.hasApprovedVenue && venuePending) {
    tone = "info";
    title = t("venueUnderReviewTitle");
    body = t("venueUnderReviewBody");
    action = null;
  } else if (!access.hasApprovedVenue && rejectedVenue) {
    tone = "error";
    title = t("venueRejectedTitle");
    body = rejectedVenue.reviewNote
      ? t("rejectionReason", { reason: rejectedVenue.reviewNote })
      : t("venueRejectedBody");
    action = { href: "/recruiter/venues", label: t("tryAgain") };
  } else if (!access.hasApprovedVenue) {
    tone = "warning";
    title = t("unverifiedTitle");
    body = t("unverifiedVenueBody");
    action = { href: "/recruiter/venues", label: t("addVenueCta") };
  } else if (!subscribed) {
    tone = "info";
    title = t("subscribeTitle");
    body = t("subscribeBody");
    action = { href: "/recruiter/upgrade", label: t("subscribeCta") };
  } else if (access.tier === "pro") {
    tone = "success";
    title = t("proTitle");
    body = t("proBody");
    action = null;
  } else {
    tone = "success";
    title = t("freeTitle");
    body = t("freeOpenAccessBody");
    action = null;
  }

  const styles = toneClass[tone];

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${styles.box}`}
      data-testid="recruiter-access-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={`mb-1 font-semibold ${styles.title}`}>{title}</h3>
          <p className={`text-sm ${styles.body}`}>{body}</p>
        </div>
        {action ? (
          <Link href={action.href} className="shrink-0">
            <Button size="sm">{action.label}</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
