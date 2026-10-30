"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Badge } from "@/components/ui";
import type { VerificationStatus } from "@/lib/db/schema";

export function RecruiterVerificationBanner(): React.ReactElement | null {
  const t = useTranslations("recruiter.verificationBanner");
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/recruiter/verification");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          verification?: { verificationStatus?: VerificationStatus };
        };
        if (!cancelled) {
          setStatus(data.verification?.verificationStatus ?? "unverified");
        }
      } catch {
        // Leave banner hidden on failure
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

  if (!loaded || !status || status === "verified") {
    return null;
  }

  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const containerClass = isPending
    ? "bg-blue-500/10 border-blue-500/30"
    : isRejected
      ? "bg-red-500/10 border-red-500/30"
      : "bg-yellow-500/10 border-yellow-500/30";
  const titleClass = isPending
    ? "text-blue-300"
    : isRejected
      ? "text-red-300"
      : "text-yellow-300";
  const bodyClass = isPending
    ? "text-blue-200/70"
    : isRejected
      ? "text-red-200/70"
      : "text-yellow-200/70";

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${containerClass}`}
      data-testid="recruiter-verification-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${titleClass}`}>
              {isPending
                ? t("pending")
                : isRejected
                  ? t("rejected")
                  : t("required")}
            </h3>
            <Badge variant={isPending ? "warning" : isRejected ? "error" : "default"}>
              {isPending
                ? t("pillPending")
                : isRejected
                  ? t("pillRejected")
                  : t("pillUnverified")}
            </Badge>
          </div>
          <p className={`text-sm ${bodyClass}`}>
            {isPending
              ? t("pendingBody")
              : isRejected
                ? t("rejectedBody")
                : t("requiredBody")}
          </p>
        </div>
        {!isPending ? (
          <Link href="/recruiter/verification">
            <Button size="sm" variant={isRejected ? "primary" : "outline"}>
              {isRejected ? t("resubmit") : t("start")}
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
