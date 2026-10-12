"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { RecruiterAccessDto } from "@/lib/recruiter-access";

function nextStepHref(access: RecruiterAccessDto): string {
  if (access.identityStatus !== "verified") {
    return "/recruiter/verification";
  }
  if (!access.hasApprovedVenue) {
    return "/recruiter/venues";
  }
  if (access.tier === "free" && !access.canViewTopTalentFull) {
    return "/recruiter/upgrade";
  }
  return "/recruiter/verification";
}

export function RecruiterAccessBanner(): React.ReactElement | null {
  const t = useTranslations("recruiter.accessBanner");
  const [access, setAccess] = useState<RecruiterAccessDto | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/recruiter/access");
        if (!response.ok) return;
        const data = (await response.json()) as RecruiterAccessDto;
        if (!cancelled) {
          setAccess(data);
        }
      } catch {
        // Hide banner on failure
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

  if (access.tier === "pro") {
    return (
      <div
        className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4"
        data-testid="recruiter-access-banner"
      >
        <h3 className="font-semibold text-green-300 mb-1">{t("proTitle")}</h3>
        <p className="text-green-200/80 text-sm">{t("proBody")}</p>
      </div>
    );
  }

  if (access.tier === "free") {
    const showUpgrade = !access.canViewTopTalentFull;
    return (
      <div
        className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4"
        data-testid="recruiter-access-banner"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold text-blue-300 mb-1">{t("freeTitle")}</h3>
            <p className="text-blue-200/80 text-sm">
              {access.canViewTopTalentFull
                ? t("freeOpenAccessBody")
                : t("freeBody")}
            </p>
          </div>
          {showUpgrade ? (
            <Link href="/recruiter/upgrade" className="shrink-0">
              <Button size="sm">{t("upgradeCta")}</Button>
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const href = nextStepHref(access);
  const needsVenue =
    access.identityStatus === "verified" && !access.hasApprovedVenue;

  return (
    <div
      className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4"
      data-testid="recruiter-access-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-yellow-300 mb-1">
            {t("unverifiedTitle")}
          </h3>
          <p className="text-yellow-200/80 text-sm">
            {needsVenue ? t("unverifiedVenueBody") : t("unverifiedBody")}
          </p>
        </div>
        <Link href={href} className="shrink-0">
          <Button size="sm">
            {needsVenue ? t("addVenueCta") : t("verifyCta")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
