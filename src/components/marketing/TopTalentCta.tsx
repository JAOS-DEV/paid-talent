"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

type BillingAccessMode = "enforced" | "open_access";

function CtaSkeleton(): React.ReactElement {
  return (
    <div className="h-12 w-full max-w-xs animate-pulse rounded-lg bg-charcoal-700" />
  );
}

export function TopTalentCta(): React.ReactElement {
  const t = useTranslations("topTalentPage");
  const { data: session, status } = useSession();
  const [billingAccessMode, setBillingAccessMode] =
    useState<BillingAccessMode>("enforced");
  const [billingLoaded, setBillingLoaded] = useState(false);

  const user = session?.user;
  const isFullUser = !!user && user.signupPending !== true;
  const isRecruiter = isFullUser && user.role === "recruiter";

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!isRecruiter) {
      setBillingAccessMode("enforced");
      setBillingLoaded(true);
      return;
    }

    let cancelled = false;
    setBillingLoaded(false);

    const load = async (): Promise<void> => {
      try {
        const response = await fetch("/api/stripe/status");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          billingAccessMode?: string;
        };
        if (
          !cancelled &&
          (data.billingAccessMode === "open_access" ||
            data.billingAccessMode === "enforced")
        ) {
          setBillingAccessMode(data.billingAccessMode);
        }
      } catch {
        // Keep enforced default
      } finally {
        if (!cancelled) {
          setBillingLoaded(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [status, isRecruiter]);

  if (status === "loading" || (isRecruiter && !billingLoaded)) {
    return <CtaSkeleton />;
  }

  if (isRecruiter) {
    const openAccess = billingAccessMode === "open_access";
    return (
      <div className="space-y-3">
        <Link
          href={openAccess ? "/recruiter/search" : "/recruiter/upgrade"}
          className="inline-flex w-full sm:w-auto"
        >
          <Button variant="gold" size="lg" className="w-full sm:w-auto">
            {openAccess ? t("ctaOpenAccess") : t("ctaUpgrade")}
          </Button>
        </Link>
        {openAccess ? (
          <p className="text-sm text-charcoal-400">{t("openAccessNote")}</p>
        ) : null}
      </div>
    );
  }

  if (isFullUser && user.role === "worker") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-charcoal-400">{t("signedInWorkerNote")}</p>
        <Link href="/worker/dashboard" className="inline-flex w-full sm:w-auto">
          <Button size="lg" className="w-full sm:w-auto">
            {t("ctaBrowse")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/auth/age-gate?role=recruiter"
      className="inline-flex w-full sm:w-auto"
    >
      <Button variant="gold" size="lg" className="w-full sm:w-auto">
        {t("ctaSignup")}
      </Button>
    </Link>
  );
}
