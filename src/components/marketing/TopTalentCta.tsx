"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

export function TopTalentCta(): React.ReactElement {
  const t = useTranslations("topTalentPage");
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-12 w-full max-w-xs animate-pulse rounded-lg bg-charcoal-700" />
    );
  }

  const user = session?.user;
  const isFullUser = !!user && user.signupPending !== true;

  if (isFullUser && user.role === "recruiter") {
    return (
      <Link href="/recruiter/upgrade" className="inline-flex w-full sm:w-auto">
        <Button variant="gold" size="lg" className="w-full sm:w-auto">
          {t("ctaUpgrade")}
        </Button>
      </Link>
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
