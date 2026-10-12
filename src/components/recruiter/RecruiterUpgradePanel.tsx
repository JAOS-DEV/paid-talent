"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, TopTalentBadge } from "@/components/ui";

type BillingProduct = "monthly" | "annual" | "pass_7d";

interface PriceOption {
  product: BillingProduct;
  unitAmount: number;
  currency: string;
  configured: boolean;
  launchAvailable: boolean;
  firstPassDiscountAvailable: boolean;
}

function formatThb(unitAmount: number): string {
  const baht = Math.round(unitAmount / 100);
  return `฿${baht.toLocaleString("en-US")}`;
}

export function RecruiterUpgradePanel(): React.ReactElement {
  const t = useTranslations("recruiterUpgrade");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<BillingProduct | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [openAccess, setOpenAccess] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [prices, setPrices] = useState<PriceOption[]>([]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const [statusRes, accessRes, pricesRes] = await Promise.all([
          fetch("/api/stripe/status"),
          fetch("/api/recruiter/access"),
          fetch("/api/stripe/prices"),
        ]);

        if (statusRes.ok) {
          const data = (await statusRes.json()) as {
            canAccessTopTalent?: boolean;
            billingAccessMode?: string;
          };
          setHasAccess(data.canAccessTopTalent === true);
          setOpenAccess(data.billingAccessMode === "open_access");
        }

        if (accessRes.ok) {
          const data = (await accessRes.json()) as { isVerified?: boolean };
          setIsVerified(data.isVerified === true);
        }

        if (pricesRes.ok) {
          const data = (await pricesRes.json()) as { prices?: PriceOption[] };
          setPrices(data.prices ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleCheckout = async (product: BillingProduct): Promise<void> => {
    setCheckingOut(product);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
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
      setCheckingOut(null);
    }
  };

  const priceFor = (product: BillingProduct): PriceOption | undefined =>
    prices.find((p) => p.product === product);

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
        ) : !isVerified ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-300">{t("verifyRequired")}</p>
            <Link href="/recruiter/verification" className="inline-flex w-full">
              <Button variant="gold" size="lg" fullWidth>
                {t("verifyCta")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {(["monthly", "annual", "pass_7d"] as const).map((product) => {
              const option = priceFor(product);
              const amount = option
                ? formatThb(option.unitAmount)
                : product === "monthly"
                  ? "฿990"
                  : product === "annual"
                    ? "฿9,900"
                    : "฿390";
              const label =
                product === "monthly"
                  ? t("monthlyLabel", { amount })
                  : product === "annual"
                    ? t("annualLabel", { amount })
                    : t("passLabel", { amount });
              const hint =
                product === "annual"
                  ? t("annualHint")
                  : product === "monthly" && option?.launchAvailable
                    ? t("launchHint")
                    : product === "pass_7d" && option?.firstPassDiscountAvailable
                      ? t("firstPassHint")
                      : null;

              return (
                <div
                  key={product}
                  className="rounded-lg border border-charcoal-700 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-charcoal-100">{label}</p>
                      {hint ? (
                        <p className="text-sm text-charcoal-400">{hint}</p>
                      ) : null}
                    </div>
                    <Button
                      variant={product === "monthly" ? "gold" : "secondary"}
                      size="md"
                      loading={checkingOut === product}
                      disabled={checkingOut !== null || option?.configured === false}
                      onClick={() => void handleCheckout(product)}
                    >
                      {t("buyCta")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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
