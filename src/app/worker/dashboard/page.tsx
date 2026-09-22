"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { VerificationStatusBanner } from "@/components/verification";
import { WorkerConfirmationCard } from "@/components/hire-outcomes";
import { WorkerRecentInterests } from "@/components/worker-interest/WorkerRecentInterests";
import { getProfileCompleteness } from "@/lib/profile";
import { getWorkerDashboardProfileAction } from "@/lib/helpers/worker-dashboard-access";
import type { WorkerDashboardData } from "@/lib/worker-dashboard";

function StatSkeleton(): React.ReactElement {
  return (
    <Card padding="lg">
      <div className="h-6 w-32 bg-charcoal-800 rounded animate-pulse mb-4" />
      <div className="h-10 w-16 bg-charcoal-800 rounded animate-pulse mb-2" />
      <div className="h-4 w-40 bg-charcoal-800 rounded animate-pulse" />
    </Card>
  );
}

export default function WorkerDashboardPage(): React.ReactElement {
  const t = useTranslations("worker.dashboard");
  const common = useTranslations("common");
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<WorkerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const dashboardLoadGeneration = useRef(0);
  const workerUserId = session?.user?.id;
  const workerRole = session?.user?.role;

  const loadDashboard = useCallback(async (generation: number): Promise<void> => {
    try {
      const res = await fetch("/api/worker/dashboard");
      if (generation !== dashboardLoadGeneration.current) {
        return;
      }
      if (!res.ok) {
        setDashboard(null);
        setLoadError(true);
        return;
      }
      const data = (await res.json()) as WorkerDashboardData;
      if (generation !== dashboardLoadGeneration.current) {
        return;
      }
      setDashboard(data);
      setLoadError(false);
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
      if (generation !== dashboardLoadGeneration.current) {
        return;
      }
      setDashboard(null);
      setLoadError(true);
    } finally {
      if (generation === dashboardLoadGeneration.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!workerUserId) {
      return;
    }

    if (workerRole !== "worker") {
      router.replace("/auth/signin");
      return;
    }

    const generation = ++dashboardLoadGeneration.current;
    void loadDashboard(generation);
  }, [workerUserId, workerRole, router, loadDashboard]);

  function handleRetry(): void {
    const generation = ++dashboardLoadGeneration.current;
    setLoading(true);
    setLoadError(false);
    void loadDashboard(generation);
  }

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (session.user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const profile = dashboard?.profile ?? null;
  const completeness = dashboard ? getProfileCompleteness(profile) : null;
  const profileAction = completeness
    ? getWorkerDashboardProfileAction(completeness)
    : {
        href: "/worker/profile",
        label: "Edit Profile" as const,
        showIncompleteTips: false,
      };
  const verificationStatus =
    dashboard?.verificationStatus || profile?.verificationStatus || "unverified";
  const isPublished = dashboard?.isPublished || profile?.isPublished || false;
  const pendingConfirmations = dashboard?.pendingConfirmations ?? [];
  const recentInterests = dashboard?.recentInterests ?? [];
  const stats = dashboard?.stats;
  const photoSlots = dashboard?.photoSlots;
  const showPhotoCta =
    verificationStatus === "verified" &&
    isPublished &&
    photoSlots !== undefined &&
    photoSlots.remainingSlots > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-charcoal-100">
              {t("welcomeNamed", {
                name:
                  session.user.name ||
                  profile?.displayName ||
                  t("fallbackName"),
              })}
            </h1>
            <p className="text-charcoal-400 mt-1">{t("subtitle")}</p>
          </div>

          {pendingConfirmations.length > 0 && (
            <div className="mb-6 space-y-4">
              {pendingConfirmations.map((request) => (
                <WorkerConfirmationCard
                  key={request.id}
                  requestId={request.id}
                  venueName={request.venueName}
                  logoUrl={request.logoUrl}
                  openingContext={request.openingContext}
                  requestedStatus={request.requestedStatus}
                  requestedAt={request.requestedAt}
                  onResponded={() => {
                    dashboardLoadGeneration.current += 1;
                    setDashboard((current) =>
                      current
                        ? {
                            ...current,
                            pendingConfirmations:
                              current.pendingConfirmations.filter(
                                (item) => item.id !== request.id
                              ),
                          }
                        : current
                    );
                  }}
                />
              ))}
            </div>
          )}

          <div className="mb-6">
            {loading && !dashboard ? (
              <div className="h-20 rounded-lg bg-charcoal-800 animate-pulse" />
            ) : dashboard ? (
              <VerificationStatusBanner
                status={verificationStatus}
                isPublished={isPublished}
                hasApprovedPrimaryPhoto={
                  dashboard.hasApprovedPrimaryPhoto ||
                  Boolean(profile?.hasApprovedPrimaryPhoto)
                }
                userId={session.user.id}
              />
            ) : null}
          </div>

          {showPhotoCta ? (
            <Card padding="md" className="mb-6" data-testid="add-photos-cta">
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-charcoal-100 font-semibold">
                      {t("addMorePhotosTitle")}
                    </h2>
                    <p className="text-charcoal-400 text-sm mt-1">
                      {photoSlots.remainingSlots === 1
                        ? t("addMorePhotosOne", {
                            count: photoSlots.remainingSlots,
                          })
                        : t("addMorePhotosOther", {
                            count: photoSlots.remainingSlots,
                          })}
                    </p>
                  </div>
                  <Link href="/worker/profile#photos" className="sm:flex-shrink-0">
                    <Button className="w-full sm:w-auto min-h-11">
                      {t("addPhotos")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && !dashboard ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : loadError ? (
              <Card padding="lg" className="md:col-span-2 lg:col-span-3">
                <CardContent>
                  <div data-testid="dashboard-load-error">
                    <p className="text-charcoal-100 font-medium">
                      {t("loadErrorTitle")}
                    </p>
                    <p className="text-charcoal-400 text-sm mt-1">
                      {t("loadErrorBody")}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <Button onClick={handleRetry}>
                        {common("retry")}
                      </Button>
                      <Link href="/worker/profile">
                        <Button variant="outline" className="w-full sm:w-auto">
                          {t("editProfile")}
                        </Button>
                      </Link>
                      <Link href="/worker/profile/preview">
                        <Button variant="outline" className="w-full sm:w-auto">
                          {t("viewProfile")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : dashboard && completeness && stats ? (
              <>
                <Card padding="lg">
                  <CardHeader>
                    <CardTitle>{t("yourProfile")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-charcoal-400 text-sm mb-4">
                      {completeness.isComplete
                        ? t("profileComplete")
                        : t("profileIncomplete")}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-charcoal-400">{t("profileStatus")}</span>
                        <span
                          className={
                            completeness.isComplete
                              ? "text-success"
                              : "text-yellow-400"
                          }
                        >
                          {completeness.isComplete
                            ? t("complete")
                            : t("percentComplete", {
                                progress: completeness.progress,
                              })}
                        </span>
                      </div>
                      <div className="w-full bg-charcoal-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${completeness.isComplete ? "bg-success" : "bg-yellow-400"}`}
                          style={{ width: `${completeness.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-4">
                      <Link href={profileAction.href}>
                        <Button fullWidth>
                          {profileAction.label === "Complete Profile"
                            ? t("completeProfile")
                            : t("editProfile")}
                        </Button>
                      </Link>
                      <Link href="/worker/profile/preview">
                        <Button variant="outline" fullWidth>
                          {t("viewProfile")}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card padding="lg">
                  <CardHeader>
                    <CardTitle>{t("profileViews")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-4xl font-bold text-primary-400 mb-2"
                      data-testid="profile-views-count"
                    >
                      {stats.uniqueRecruiterViewersLast30Days}
                    </div>
                    <p className="text-charcoal-400 text-sm">
                      {t("uniqueRecruiters")}
                    </p>
                    <div className="mt-4 text-sm text-charcoal-500">
                      {stats.profileViewEventsLast30Days > 0
                        ? stats.profileViewEventsLast30Days === 1
                          ? t("totalViewsOne", {
                              count: stats.profileViewEventsLast30Days,
                            })
                          : t("totalViewsOther", {
                              count: stats.profileViewEventsLast30Days,
                            })
                        : completeness.isComplete
                          ? t("shareProfile")
                          : t("completeToGetViews")}
                    </div>
                  </CardContent>
                </Card>

                <Card padding="lg">
                  <CardHeader>
                    <CardTitle>{t("interestReceived")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-4xl font-bold text-primary-400 mb-2"
                      data-testid="interest-received-count"
                    >
                      {stats.interestReceivedCount}
                    </div>
                    <p className="text-charcoal-400 text-sm">
                      {t("recruitersInterested")}
                    </p>
                    <div className="mt-4 text-sm text-charcoal-500">
                      {t("interestNotify")}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          <WorkerRecentInterests interests={recentInterests} />

          {profileAction.showIncompleteTips && completeness ? (
            <div className="mt-8">
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>{t("quickTips")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary-400">1</span>
                      </span>
                      <span className="text-charcoal-300 text-sm">
                        {t("tipPhoto")}
                      </span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary-400">2</span>
                      </span>
                      <span className="text-charcoal-300 text-sm">
                        {t("tipRoles")}
                      </span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary-400">3</span>
                      </span>
                      <span className="text-charcoal-300 text-sm">
                        {t("tipAvailability")}
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
