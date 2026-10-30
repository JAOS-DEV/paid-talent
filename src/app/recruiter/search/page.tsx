"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  TopTalentBadge,
} from "@/components/ui";
import { AdSense, ADS_CONFIGURED } from "@/components/ads";
import { RecruiterAccessBanner, TeaserPhoto } from "@/components/recruiter";
import { SendContactRequestDialog } from "@/components/contact-requests";
import type { SearchWorkerResult } from "@/lib/recruiter-access/worker-dto";
import type { RecruiterAccessDto } from "@/lib/recruiter-access";
import {
  ADD_VENUE_HREF,
  teaserContactCta,
  teaserPlaceLabel,
  type TeaserCta,
} from "@/lib/recruiter-access/teaser-cta";
import { AvailabilityBadges } from "@/components/profile/AvailabilityBadges";
import { AVAILABILITY_OPTIONS } from "@/lib/profile/availability";
import {
  AVAILABILITY_MESSAGE_KEYS,
  JOB_ROLE_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";
import {
  DEFAULT_WORKER_EXPECTED_PAY_PERIOD,
  WORKER_EXPECTED_PAY_AMOUNT_MAX,
  WORKER_EXPECTED_PAY_PERIOD_OPTIONS,
  type WorkerExpectedPayPeriod,
  formatWorkerExpectedPay,
} from "@/lib/profile/expected-pay";

interface WorkerCardProps {
  worker: SearchWorkerResult;
  interestSent: boolean;
  onExpressInterest: () => void;
  teaserCta: TeaserCta | null;
}

function WorkerCard({
  worker,
  interestSent,
  onExpressInterest,
  teaserCta,
}: WorkerCardProps): React.ReactElement {
  const t = useTranslations("recruiter.search");
  const roleLabels = useTranslations("roles");

  if (worker.mode === "teaser") {
    const place = teaserPlaceLabel(worker);
    const role = worker.jobRoles[0];
    return (
      <Card hover padding="lg">
        <CardContent>
          <div className="flex items-start space-x-4">
            <TeaserPhoto src={worker.teaserPhotoPath} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-semibold text-charcoal-100 truncate">
                  {worker.firstName ?? t("teaserNameHidden")}
                </h3>
                {worker.isTopTalent && <TopTalentBadge />}
                <Badge variant="success">{t("verified")}</Badge>
              </div>

              {place ? (
                <p className="text-charcoal-400 text-sm mb-2">{place}</p>
              ) : null}
              {role ? (
                <p className="text-charcoal-200 text-sm mb-2">
                  {translateCatalogValue(roleLabels, JOB_ROLE_MESSAGE_KEYS, role)}
                </p>
              ) : null}
              {worker.payBand ? (
                <p className="text-charcoal-300 text-sm">{worker.payBand}</p>
              ) : null}
            </div>
          </div>

          {teaserCta ? (
            <div className="mt-4 pt-4 border-t border-charcoal-700">
              <Link href={teaserCta.href} className="inline-flex">
                <Button size="sm">
                  {teaserCta.kind === "subscribe"
                    ? t("subscribeToContact")
                    : teaserCta.href === ADD_VENUE_HREF
                      ? t("addVenueToUnlock")
                      : t("verifyIdentityToUnlock")}
                </Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const expectedPayLabel = formatWorkerExpectedPay(worker);

  return (
    <Card hover padding="lg">
      <CardContent>
        <div className="flex items-start space-x-4">
          {worker.photoUrl ? (
            <img
              src={worker.photoUrl}
              alt={worker.displayName}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-charcoal-700 flex-shrink-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-charcoal-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-lg font-semibold text-charcoal-100 truncate">
                {worker.displayName}
              </h3>
              {worker.isTopTalent && <TopTalentBadge />}
              {worker.isVerified && (
                <Badge variant="success">{t("verified")}</Badge>
              )}
            </div>

            {(worker.location || worker.area) && (
              <p className="text-charcoal-400 text-sm mb-2">
                {worker.location || worker.area}
              </p>
            )}

            {worker.jobRoles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {worker.jobRoles.slice(0, 3).map((role) => (
                  <Badge key={role}>
                    {translateCatalogValue(roleLabels, JOB_ROLE_MESSAGE_KEYS, role)}
                  </Badge>
                ))}
                {worker.jobRoles.length > 3 && (
                  <Badge variant="default">+{worker.jobRoles.length - 3}</Badge>
                )}
              </div>
            )}

            {worker.availability.length > 0 && (
              <div className="mb-1">
                <AvailabilityBadges values={worker.availability} />
              </div>
            )}

            {expectedPayLabel ? (
              <p className="text-charcoal-300 text-sm mt-2">{expectedPayLabel}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal-700">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Link href={`/recruiter/profile/${worker.id}`}>
              <Button variant="outline" size="sm">
                {t("viewProfile")}
              </Button>
            </Link>
            {interestSent ? (
              <Button size="sm" variant="secondary" disabled>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t("requestSent")}
              </Button>
            ) : (
              <Button size="sm" onClick={onExpressInterest}>
                {t("sendContactRequest")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SearchFilters {
  query: string;
  role: string;
  area: string;
  availability: string;
  maxPay: string;
  payPeriod: WorkerExpectedPayPeriod;
}

export default function SearchPage(): React.ReactElement {
  const t = useTranslations("recruiter.search");
  const roleLabels = useTranslations("roles");
  const availabilityLabels = useTranslations("availability");
  const { data: session, status } = useSession();
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    role: "",
    area: "",
    availability: "",
    maxPay: "",
    payPeriod: DEFAULT_WORKER_EXPECTED_PAY_PERIOD,
  });
  const [workers, setWorkers] = useState<SearchWorkerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sentInterests, setSentInterests] = useState<Set<string>>(new Set());
  const [dialogWorker, setDialogWorker] = useState<{
    id: string;
    displayName?: string;
    isTopTalent?: boolean;
  } | null>(null);
  const [access, setAccess] = useState<RecruiterAccessDto | null>(null);

  const canBrowseFull = access?.canBrowseFull === true;
  const teaserCta = teaserContactCta({
    isVerified: access?.isVerified === true,
    identityVerified: access?.identityStatus === "verified",
    hasActivePlan: access?.tier === "pro",
  });

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (canBrowseFull && filters.query) params.set("query", filters.query);
      if (filters.role) params.set("role", filters.role);
      if (filters.area) params.set("area", filters.area);
      if (filters.availability) params.set("availability", filters.availability);
      if (canBrowseFull && filters.maxPay.trim()) {
        params.set("maxPay", filters.maxPay.trim());
        params.set("payPeriod", filters.payPeriod);
      }

      const response = await fetch(`/api/workers/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers);
        setTotal(data.pagination?.total ?? data.total ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, canBrowseFull]);

  const fetchSentRequests = useCallback(async () => {
    try {
      const response = await fetch("/api/contact-requests?box=sent");
      if (response.ok) {
        const data = await response.json();
        const profileIds = new Set<string>(
          (data.requests ?? [])
            .filter(
              (r: { status: string }) =>
                r.status === "queued" ||
                r.status === "pending" ||
                r.status === "accepted"
            )
            .map((r: { workerProfileId: string }) => r.workerProfileId)
        );
        setSentInterests(profileIds);
      }
    } catch {
      setSentInterests(new Set());
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const loadData = async (): Promise<void> => {
      try {
        const response = await fetch("/api/recruiter/access");
        if (!cancelled && response.ok) {
          setAccess((await response.json()) as RecruiterAccessDto);
        }
      } catch {
        if (!cancelled) setAccess(null);
      }

      if (cancelled) return;

      await Promise.all([fetchWorkers(), fetchSentRequests()]);
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilters = (): void => {
    fetchWorkers();
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.role !== "recruiter") {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RecruiterAccessBanner />

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              {t("pageTitle")}
            </h1>
            <p className="text-charcoal-400 mt-1">{t("subtitle")}</p>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Card padding="lg">
                <CardContent className="space-y-4">
                  <h3 className="font-semibold text-charcoal-100">{t("filters")}</h3>

                  {canBrowseFull ? (
                    <Input
                      label={t("searchLabel")}
                      placeholder={t("searchPlaceholder")}
                      value={filters.query}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, query: e.target.value }))
                      }
                    />
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      {t("jobRole")}
                    </label>
                    <select
                      value={filters.role}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, role: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">{t("allRoles")}</option>
                      {["Bartender", "Server", "Host/Hostess", "Chef", "Barista", "Manager", "DJ"].map(
                        (role) => (
                          <option key={role} value={role}>
                            {translateCatalogValue(
                              roleLabels,
                              JOB_ROLE_MESSAGE_KEYS,
                              role
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      {t("area")}
                    </label>
                    <select
                      value={filters.area}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, area: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">{t("allAreas")}</option>
                      <option value="Bangkok">Bangkok</option>
                      <option value="Pattaya">Pattaya</option>
                      <option value="Phuket">Phuket</option>
                      <option value="Chiang Mai">Chiang Mai</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                      {t("availability")}
                    </label>
                    <select
                      value={filters.availability}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          availability: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">{t("anyAvailability")}</option>
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {translateCatalogValue(
                            availabilityLabels,
                            AVAILABILITY_MESSAGE_KEYS,
                            option
                          )}
                        </option>
                      ))}
                    </select>
                  </div>

                  {canBrowseFull ? (
                    <div>
                      <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
                        {t("maxExpectedPay")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={WORKER_EXPECTED_PAY_AMOUNT_MAX}
                          step={1}
                          placeholder={t("maxPayPlaceholder")}
                          value={filters.maxPay}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, maxPay: e.target.value }))
                          }
                          className="flex-1"
                        />
                        <select
                          value={filters.payPeriod}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              payPeriod: e.target
                                .value as WorkerExpectedPayPeriod,
                            }))
                          }
                          aria-label={t("payPeriod")}
                          className="px-3 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {WORKER_EXPECTED_PAY_PERIOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value === "day"
                                ? t("perDay")
                                : t("perMonth")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-charcoal-500 text-xs mt-1.5">
                        {t("payFilterHint")}
                      </p>
                    </div>
                  ) : null}

                  <Button fullWidth onClick={handleApplyFilters}>
                    {t("applyFilters")}
                  </Button>
                </CardContent>
              </Card>

              {ADS_CONFIGURED ? (
                <div className="mt-6">
                  <AdSense adSlot="search-sidebar" adFormat="vertical" />
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-3">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Link
                  href="/recruiter/requests"
                  className="text-sm text-primary-400 hover:text-primary-300"
                >
                  {t("viewRequests")}
                </Link>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-charcoal-400 text-sm">
                  {loading
                    ? t("searching")
                    : total > 0
                      ? total === 1
                        ? t("foundOne", { count: total })
                        : t("foundOther", { count: total })
                      : t("noVerified")}
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : workers.length > 0 ? (
                <div className="space-y-4">
                  {workers.map((worker) => (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      interestSent={sentInterests.has(worker.id)}
                      onExpressInterest={() =>
                        setDialogWorker({
                          id: worker.id,
                          displayName:
                            worker.mode === "full"
                              ? worker.displayName
                              : worker.firstName ?? undefined,
                          isTopTalent: worker.isTopTalent,
                        })
                      }
                      teaserCta={teaserCta}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-charcoal-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-4 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p>{t("noMatch")}</p>
                  <p className="text-sm mt-2">{t("adjustFilters")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {dialogWorker ? (
        <SendContactRequestDialog
          open
          workerProfileId={dialogWorker.id}
          workerDisplayName={dialogWorker.displayName}
          isTopTalent={dialogWorker.isTopTalent}
          onClose={() => setDialogWorker(null)}
          onSent={() => {
            setSentInterests(
              (prev) => new Set([...prev, dialogWorker.id])
            );
            setDialogWorker(null);
          }}
        />
      ) : null}
    </div>
  );
}
