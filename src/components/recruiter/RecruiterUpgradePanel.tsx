"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, TopTalentBadge } from "@/components/ui";

export function RecruiterUpgradePanel(): React.ReactElement {
  const t = useTranslations("recruiterUpgrade");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [openAccess, setOpenAccess] = useState(false);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const response = await fetch("/api/stripe/status");
        if (response.ok) {
          const data = (await response.json()) as {
            canAccessTopTalent?: boolean;
            billingAccessMode?: string;
          };
          setHasAccess(data.canAccessTopTalent === true);
          setOpenAccess(data.billingAccessMode === "open_access");
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSubscribe = async (): Promise<void> => {
    setCheckingOut(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = (await response.json()) as { url?: string };
        if (data.url) {
          router.push(data.url);
          return;
        }
      }
    } catch {
      // Stay on page; user can retry
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-xl bg-charcoal-800" />
    );
  }

  return (
    <div className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-5 sm:p-6">
      <div className="mb-4">
        <TopTalentBadge />
      </div>
      <h1 className="text-2xl font-bold text-charcoal-100 sm:text-3xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-charcoal-400">{t("subtitle")}</p>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-400">
        {t("body")}
      </p>

      <div className="mt-6 space-y-3">
        {openAccess ? (
          <p className="text-sm text-green-400">{t("openAccess")}</p>
        ) : hasAccess ? (
          <p className="text-sm text-green-400">{t("hasAccess")}</p>
        ) : (
          <Button
            variant="gold"
            size="lg"
            fullWidth
            loading={checkingOut}
            disabled={checkingOut}
            onClick={handleSubscribe}
          >
            {t("cta")}
          </Button>
        )}
        <Link href="/recruiter/search" className="inline-flex w-full">
          <Button variant="secondary" size="lg" fullWidth>
            {t("browseCta")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
